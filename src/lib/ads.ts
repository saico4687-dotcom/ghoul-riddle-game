import { Capacitor } from "@capacitor/core";

/* ============================================================
 *  AdMob unit IDs (production)
 * ============================================================ */
export const ADMOB_APP_ID = "ca-app-pub-4098736191122679~4275235624";
export const INTERSTITIAL_AD_ID =
"ca-app-pub-3940256099942544/1033173712";

export const REWARDED_AD_ID = "ca-app-pub-4098736191122679/5486713665";

export const BANNER_AD_ID = "ca-app-pub-4098736191122679/2540986126";
/* ============================================================
 * Internal State
 * ============================================================ */

let initialized = false;
let initPromise: Promise<void> | null = null;

let interstitialLoaded = false;
let interstitialLoading = false;

let rewardedLoaded = false;
let rewardedLoading = false;

// يُضبط على true فقط عند وصول حدث المكافأة الحقيقي من AdMob
// (onRewardedVideoAdReward)، ويُستخدم لمعرفة هل استحق المستخدم
// المكافأة فعلًا وقت إغلاقه للإعلان بنفسه.
let rewardEarnedFlag = false;

let bannerVisible = false;
let anyFullscreenAdShowing = false;

let listenersRegistered = false;

let interstitialRetryDelay = 30_000; // يبدأ بـ 30 ثانية ويتضاعف حتى 5 دقائق
let interstitialRetryTimer: ReturnType<typeof setTimeout> | null = null;

let rewardedRetryDelay = 30_000;
let rewardedRetryTimer: ReturnType<typeof setTimeout> | null = null;

const MAX_RETRY_DELAY = 5 * 60_000; // 5 دقائق كحد أقصى بين المحاولات

const scheduleInterstitialRetry = () => {
    if (interstitialRetryTimer) return; // في انتظار محاولة سابقة بالفعل
    interstitialRetryTimer = setTimeout(() => {
        interstitialRetryTimer = null;
        interstitialRetryDelay = Math.min(interstitialRetryDelay * 2, MAX_RETRY_DELAY);
        void preloadInterstitial();
    }, interstitialRetryDelay);
};

const scheduleRewardedRetry = () => {
    if (rewardedRetryTimer) return;
    rewardedRetryTimer = setTimeout(() => {
        rewardedRetryTimer = null;
        rewardedRetryDelay = Math.min(rewardedRetryDelay * 2, MAX_RETRY_DELAY);
        void preloadRewarded();
    }, rewardedRetryDelay);
};

const isNative = () => Capacitor.isNativePlatform();

async function getAdMob() {
    return await import("@capacitor-community/admob");
}

/* ============================================================
 * لوحة تشخيص بسيطة على الشاشة (بديل eruda)
 * بتعرض تفاصيل كل خطأ حقيقي من AdMob SDK (code / message / details
 * القادمين من Google نفسه، مش بس رقم 403) جوّه التطبيق مباشرة، من
 * غير أي مكتبة خارجية. اضغطي مطولًا (نص ثانية) على زرار 🐞 عشان
 * تفتحي "مُفتش الإعلانات" الرسمي (راجعي دالة openAdInspector تحت).
 * ============================================================ */
let debugPanelEl: HTMLDivElement | null = null;
const debugLogLines: string[] = [];

const ensureDebugPanel = () => {
    if (typeof document === "undefined") return null;
    if (debugPanelEl) return debugPanelEl;

    const panel = document.createElement("div");
    panel.id = "admob-debug-panel";
    panel.style.cssText = `
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        max-height: 45vh;
        overflow-y: auto;
        background: rgba(0,0,0,0.88);
        color: #0f0;
        font-family: monospace;
        font-size: 11px;
        line-height: 1.5;
        padding: 10px;
        padding-bottom: 44px;
        z-index: 999999;
        display: none;
        white-space: pre-wrap;
        direction: ltr;
        text-align: left;
    `;
    document.body.appendChild(panel);

    // زرار صغير ثابت في ركن الشاشة يفتح/يقفل اللوحة
    const toggle = document.createElement("div");
    toggle.textContent = "🐞";
    toggle.style.cssText = `
        position: fixed;
        bottom: 10px;
        right: 10px;
        width: 34px;
        height: 34px;
        background: rgba(0,0,0,0.65);
        color: #fff;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 17px;
        z-index: 1000000;
        cursor: pointer;
    `;
    toggle.onclick = () => {
        panel.style.display = panel.style.display === "none" ? "block" : "none";
    };

    // ضغطة مطوّلة (نص ثانية) على الزرار → تفتح مُفتش الإعلانات الرسمي مباشرة
    let pressTimer: ReturnType<typeof setTimeout> | null = null;
    const startPress = () => {
        pressTimer = setTimeout(() => {
            pressTimer = null;
            void openAdInspector();
        }, 500);
    };
    const cancelPress = () => {
        if (pressTimer) {
            clearTimeout(pressTimer);
            pressTimer = null;
        }
    };
    toggle.addEventListener("touchstart", startPress, { passive: true });
    toggle.addEventListener("touchend", cancelPress);
    toggle.addEventListener("touchcancel", cancelPress);
    toggle.addEventListener("mousedown", startPress);
    toggle.addEventListener("mouseup", cancelPress);
    toggle.addEventListener("mouseleave", cancelPress);

    document.body.appendChild(toggle);

    debugPanelEl = panel;
    return panel;
};

const pushDebugLog = (line: string) => {
    const time = new Date().toLocaleTimeString();
    debugLogLines.push(`[${time}] ${line}`);
    if (debugLogLines.length > 60) debugLogLines.shift();

    const panel = ensureDebugPanel();
    if (panel) panel.textContent = debugLogLines.join("\n\n");
};

// لوج عادي في الـ console + نفس السطر في اللوحة على الشاشة
const logInfo = (msg: string) => {
    console.log(msg);
    pushDebugLog(msg);
};

const logAdMobError = (context: string, error: any) => {
    const info = {
        message: error?.message ?? "Unknown Error",
        code: error?.code ?? "N/A",
        details: error?.details ?? error,
    };
    console.error(`❌ [AdMob] ${context}`, {
        ...info,
        stack: error?.stack,
        raw: error,
    });
    pushDebugLog(
        `❌ ${context}\ncode: ${info.code}\nmessage: ${info.message}\ndetails: ${JSON.stringify(info.details)}`
    );
};

/* ============================================================
 * فتح "مُفتش الإعلانات" الرسمي من جوجل (Ad Inspector)
 * ملحوظة: دي دالة native مُضافة يدويًا في الـ plugin (عن طريق
 * patch-package — راجع patches/@capacitor-community+admob+8.0.0.patch)
 * ومش موجودة في تعريفات TypeScript الأصلية بتاعة الـ plugin، فمحتاجين
 * نتخطى فحص الأنواع هنا (as any) عشان ننادي عليها. برجّة Capacitor
 * بتوصّل أي اسم دالة native بالاسم مباشرة، فده هيشتغل طالما الـ
 * patch اتطبّق والتطبيق اتبنى من جديد.
 * ============================================================ */
export const openAdInspector = async (): Promise<void> => {
    if (!isNative()) {
        logInfo("[AdMob] Ad Inspector غير متاح على الويب — شغّال على تطبيق native بس.");
        return;
    }

    try {
        await initAdMob();
        const { AdMob } = await getAdMob();
        logInfo("[AdMob] Opening Ad Inspector...");
        await (AdMob as any).openAdInspector();
    } catch (e) {
        logAdMobError("Open Ad Inspector", e);
    }
};

/* ============================================================
 * UMP Consent
 * ============================================================ */

export const requestUMPConsent = async () => {
    if (!isNative()) return;

    try {
        const { AdMob } = await getAdMob();
        logInfo("[AdMob] Requesting consent...");

        const consent = await AdMob.requestConsentInfo();
        logInfo(`[AdMob] Consent Status: ${JSON.stringify(consent)}`);

        if (consent.isConsentFormAvailable && consent.status === "REQUIRED") {
            logInfo("[AdMob] Showing consent form...");
            await AdMob.showConsentForm();
        }
    } catch (e) {
        logAdMobError("Consent", e);
    }
};

// نقطة الدخول المطلوبة من AdMob: تسمح للمستخدم إنه يفتح نموذج
// خيارات الخصوصية تاني في أي وقت بعد أول مرة (لازمة عشان تقدر
// تنشر رسالة الـ US/EEA من AdMob Console).
export const showPrivacyOptions = async () => {
    if (!isNative()) {
        // على الويب مفيش AdMob SDK أصلاً، فمفيش فورم نعرضه.
        // نرمي خطأ واضح عشان الواجهة تقدر تعرض رسالة للمستخدم
        // بدل ما الزر "يفصل جسمه" من غير أي رد فعل.
        throw new Error("NOT_NATIVE");
    }

    try {
        const { AdMob } = await getAdMob();
        console.log("[AdMob] Showing Privacy Options form...");
        await AdMob.showPrivacyOptionsForm();
    } catch (e) {
        logAdMobError("Show Privacy Options", e);
        // نرمي تاني (بدل الاكتفاء باللوج) عشان المتصل يقدر يبلّغ المستخدم
        throw e;
    }
};

/* ============================================================
 * Initialization
 * ============================================================ */

export const initAdMob = async (): Promise<void> => {
    if (initialized) return;
    if (initPromise) return initPromise;

    initPromise = (async () => {
        if (!isNative()) {
            initialized = true;
            console.log("[AdMob] Running on Web.");
            return;
        }

        try {
            logInfo("[AdMob] Initializing...");

            const { AdMob, InterstitialAdPluginEvents, RewardAdPluginEvents, BannerAdPluginEvents } = await getAdMob();

            await requestUMPConsent();

            await AdMob.initialize({
                initializeForTesting: false,   // غيّر إلى true أثناء الاختبار
            });

            logInfo("[AdMob] SDK initialized");

            // Register listeners once
            if (!listenersRegistered) {
                listenersRegistered = true;
                logInfo("[AdMob] Registering listeners...");

                // Banner Listeners — عشان نعرف هل الإعلان اتحمّل فعلاً ولا "No Fill" زي الباقي
                AdMob.addListener(BannerAdPluginEvents.Loaded, () => {
                    logInfo("✅✅ Banner AD ACTUALLY LOADED (real ad received)");
                });

                AdMob.addListener(BannerAdPluginEvents.FailedToLoad, (e) => {
                    logAdMobError("Banner Load FAILED (No real ad)", e);
                });

                AdMob.addListener(BannerAdPluginEvents.SizeChanged, (info) => {
                    console.log("[AdMob] Banner Size Changed:", info);
                });

                // Interstitial Listeners
                AdMob.addListener(InterstitialAdPluginEvents.Loaded, () => {
                    console.log("✅ Interstitial Loaded");
                    interstitialLoaded = true;
                    interstitialLoading = false;
                    interstitialRetryDelay = 30_000;
                });

                AdMob.addListener(InterstitialAdPluginEvents.FailedToLoad, (e) => {
                    interstitialLoaded = false;
                    interstitialLoading = false;
                    logAdMobError("Interstitial Load", e);
                    scheduleInterstitialRetry();
                });

                AdMob.addListener(InterstitialAdPluginEvents.Showed, () => {
                    console.log("✅ Interstitial Showed");
                    anyFullscreenAdShowing = true;
                });

                AdMob.addListener(InterstitialAdPluginEvents.Dismissed, () => {
                    console.log("✅ Interstitial Closed");
                    anyFullscreenAdShowing = false;
                    interstitialLoaded = false;
                    void preloadInterstitial();
                });

                AdMob.addListener(InterstitialAdPluginEvents.FailedToShow, (e) => {
                    anyFullscreenAdShowing = false;
                    interstitialLoaded = false;
                    logAdMobError("Interstitial Show", e);
                    void preloadInterstitial();
                });

                // Rewarded Listeners
                AdMob.addListener(RewardAdPluginEvents.Rewarded, () => {
                    console.log("✅ Rewarded: user earned reward");
                    rewardEarnedFlag = true;
                });

                AdMob.addListener(RewardAdPluginEvents.Loaded, () => {
                    console.log("✅ Rewarded Loaded");
                    rewardedLoaded = true;
                    rewardedLoading = false;
                    rewardedRetryDelay = 30_000;
                });

                AdMob.addListener(RewardAdPluginEvents.FailedToLoad, (e) => {
                    rewardedLoaded = false;
                    rewardedLoading = false;
                    logAdMobError("Rewarded Load", e);
                    scheduleRewardedRetry();
                });

                AdMob.addListener(RewardAdPluginEvents.Showed, () => {
                    console.log("✅ Rewarded Showed");
                    anyFullscreenAdShowing = true;
                });

                AdMob.addListener(RewardAdPluginEvents.Dismissed, () => {
                    console.log("✅ Rewarded Closed");
                    anyFullscreenAdShowing = false;
                    rewardedLoaded = false;
                    void preloadRewarded();
                });

                AdMob.addListener(RewardAdPluginEvents.FailedToShow, (e) => {
                    anyFullscreenAdShowing = false;
                    rewardedLoaded = false;
                    logAdMobError("Rewarded Show", e);
                    void preloadRewarded();
                });
            }

            initialized = true;
            logInfo("[AdMob] Preloading ads...");

            void preloadInterstitial();
            void preloadRewarded();

            logInfo("✅ AdMob Ready");

        } catch (e) {
            initialized = false;
            initPromise = null;
            logAdMobError("Initialization", e);
        }
    })();

    return initPromise;
};

/* ============================================================
 * PRELOADERS
 * ============================================================ */

// ملحوظة: دالة prepareBanner القديمة اتشالت — showBanner() بتحمّل وتعرض
// البانر في خطوة واحدة، ومفيش داعي لاستدعاء prepareBanner (اللي كانت
// بترجع خطأ "not implemented on android" في نسخة الـ plugin دي أصلاً).

// أقل فترة مسموح بيها بين محاولتين تحميل، عشان منضربش Rate limit بتاع AdMob
// ("Too many recently failed requests for ad unit ID")
const MIN_PRELOAD_GAP = 30_000;
let lastInterstitialAttempt = 0;
let lastRewardedAttempt = 0;

export const preloadInterstitial = async () => {
    if (!isNative() || interstitialLoaded || interstitialLoading) return;

    const now = Date.now();
    if (now - lastInterstitialAttempt < MIN_PRELOAD_GAP) {
        console.log("[AdMob] Skipping Interstitial preload (cooldown active)");
        return;
    }
    lastInterstitialAttempt = now;

    interstitialLoading = true;
    logInfo("[AdMob] Loading Interstitial...");

    try {
        const { AdMob } = await getAdMob();
        await AdMob.prepareInterstitial({ adId: INTERSTITIAL_AD_ID });
    } catch (e) {
        interstitialLoaded = false;
        logAdMobError("Preload Interstitial", e);
    } finally {
        interstitialLoading = false;
    }
};

export const preloadRewarded = async () => {
    if (!isNative() || rewardedLoaded || rewardedLoading) return;

    const now = Date.now();
    if (now - lastRewardedAttempt < MIN_PRELOAD_GAP) {
        console.log("[AdMob] Skipping Rewarded preload (cooldown active)");
        return;
    }
    lastRewardedAttempt = now;

    rewardedLoading = true;
    logInfo("[AdMob] Loading Rewarded...");

    try {
        const { AdMob } = await getAdMob();
        await AdMob.prepareRewardVideoAd({ adId: REWARDED_AD_ID });   // تم التصحيح
    } catch (e) {
        rewardedLoaded = false;
        logAdMobError("Preload Rewarded", e);
    } finally {
        rewardedLoading = false;
    }
};

/* ============================================================
 * SHOW FUNCTIONS
 * ============================================================ */

export const showBannerAd = async () => {
    if (!isNative() || bannerVisible) return;

    try {
        await initAdMob();
        const { AdMob, BannerAdPosition, BannerAdSize } = await getAdMob();

        console.log("[AdMob] Showing Banner");

        await AdMob.showBanner({
            adId: BANNER_AD_ID,
            adSize: BannerAdSize.ADAPTIVE_BANNER,
            position: BannerAdPosition.BOTTOM_CENTER,
            margin: 0,
        });

        bannerVisible = true;
        console.log("✅ Banner Visible");
    } catch (e) {
        bannerVisible = false;
        logAdMobError("Banner Show", e);
    }
};

export const hideBannerAd = async () => {
    if (!isNative() || !bannerVisible) return;

    try {
        const { AdMob } = await getAdMob();
        await AdMob.removeBanner();
        console.log("✅ Banner Hidden");
    } catch (e) {
        logAdMobError("Banner Hide", e);
    } finally {
        bannerVisible = false;
    }
};

export const showInterstitial = async (): Promise<boolean> => {
    if (!isNative()) return false;
    if (anyFullscreenAdShowing) return false;

    try {
        await initAdMob();
        const { AdMob } = await getAdMob();

        if (!interstitialLoaded) await preloadInterstitial();

        if (!interstitialLoaded) {
            console.error("[AdMob] Interstitial NOT Loaded");
            return false;
        }

        console.log("▶ Showing Interstitial");
        anyFullscreenAdShowing = true;

        await AdMob.showInterstitial();

        // انتظر حتى يغلق المستخدم الإعلان
        await new Promise<void>((resolve) => {
            const check = setInterval(() => {
                if (!anyFullscreenAdShowing) {
                    clearInterval(check);
                    resolve();
                }
            }, 100);
        });

        return true;
    } catch (e) {
        logAdMobError("Show Interstitial", e);
        return false;
    } finally {
        anyFullscreenAdShowing = false;
    }
};

export const showRewarded = async (opts?: { onStart?: () => void; onEnd?: () => void }): Promise<boolean> => {
    if (!isNative()) {
        console.log("[AdMob] Web Preview -> Reward Granted");
        opts?.onEnd?.();
        return true;
    }

    if (anyFullscreenAdShowing) return false;

    try {
        await initAdMob();
        const { AdMob } = await getAdMob();

        if (!rewardedLoaded) await preloadRewarded();

        if (!rewardedLoaded) {
            console.error("[AdMob] Rewarded NOT Loaded");
            return false;
        }

        opts?.onStart?.();
        console.log("▶ Showing Rewarded");
        anyFullscreenAdShowing = true;
        rewardEarnedFlag = false;

        await AdMob.showRewardVideoAd();

        // انتظر حتى يغلق المستخدم الإعلان بنفسه فعليًا (حدث Dismissed)
        // قبل إرجاع النتيجة — حتى لا تُستأنف الساعة قبل الإغلاق الحقيقي.
        await new Promise<void>((resolve) => {
            const check = setInterval(() => {
                if (!anyFullscreenAdShowing) {
                    clearInterval(check);
                    resolve();
                }
            }, 100);
        });

        console.log("✅ Rewarded Completed, earned =", rewardEarnedFlag);
        return rewardEarnedFlag;
    } catch (e) {
        logAdMobError("Show Rewarded", e);
        return false;
    } finally {
        anyFullscreenAdShowing = false;
        rewardedLoaded = false;
        void preloadRewarded();
        opts?.onEnd?.();
    }
};
