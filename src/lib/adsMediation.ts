import { LevelPlayAds, isNative, LevelPlayEvent, LevelPlayFormat } from "./levelplayAds";

/* ============================================================
 * Unity LevelPlay (ironSource) — المصدر الوحيد للإعلانات في
 * التطبيق. تم إلغاء AdMob (@capacitor-community/admob) نهائيًا:
 * لا استيراد، لا مفاتيح، لا مزاد بين شبكتين — LevelPlay هو اللي
 * بيتكفّل بالـ mediation بين شبكات الإعلانات المختلفة داخليًا.
 * ============================================================ */
const LEVELPLAY_APP_KEY = "275ab5f05";

const LP_BANNER_AD_UNIT = "knkysfwy8lg9cv37";
const LP_INTERSTITIAL_MAIN_AD_UNIT = "75c2gz1s0rkeaqja";
const LP_INTERSTITIAL_CHAT_AD_UNIT = "44okuay8c4lvv5us";
const LP_REWARDED_MAIN_AD_UNIT = "8687xc91zz0g0jbb";
const LP_REWARDED_CHAT_AD_UNIT = "bk6q4274l0mg6x3r";

// المفتاح المستخدم لتخزين اختيار المستخدم في AdsConsentDialog —
// مُصدَّر من هنا عشان يبقى مصدر واحد للحقيقة، وعشان App.tsx يقدر
// يتأكد هل المستخدم رد على نافذة الموافقة قبل ما يبدأ تحميل أي إعلان.
export const CONSENT_KEY = "ads_consent_v1";

// true = نطلب إعلانات غير مخصصة. بيتحدد من اختيار المستخدم في
// AdsConsentDialog عن طريق setAdsPersonalization، وقبل ما يتحدد
// بنفترض غير مخصص (الأكثر أمانًا).
let nonPersonalizedAds = true;
export const setAdsPersonalization = (personalized: boolean) => {
    nonPersonalizedAds = !personalized;
};

/* ============================================================
 * حالة جاهزية إعلانات LevelPlay (بالـ tag: interstitial_main،
 * interstitial_chat، rewarded_main، rewarded_chat، banner)
 * ============================================================ */
const lpReady: Record<string, boolean> = {};

let lpInitialized = false;
let lpInitPromise: Promise<void> | null = null;

const reloadInterstitial = (tag: string, adUnitId: string) => {
    lpReady[tag] = false;
    void LevelPlayAds.loadInterstitial({ adUnitId, tag });
};

const reloadRewarded = (tag: string, adUnitId: string) => {
    lpReady[tag] = false;
    void LevelPlayAds.loadRewarded({ adUnitId, tag });
};

/* ============================================================
 * إعادة محاولة تلقائية للفاصل والمكافأة لو التحميل فشل (failedToLoad)
 * — عشان إعلانات المكافأة/الفاصل تبقى جاهزة قد الإمكان بدل ما تفضل
 * فاضية للأبد بعد أول فشل. البانر عنده آلية شبيهة مستقلة بالفعل.
 * ============================================================ */
const AD_RETRY_MS = 15000;
const pendingReload: Record<string, ReturnType<typeof setTimeout> | null> = {};

const TAG_TO_UNIT: Record<string, string> = {
    interstitial_main: LP_INTERSTITIAL_MAIN_AD_UNIT,
    interstitial_chat: LP_INTERSTITIAL_CHAT_AD_UNIT,
    rewarded_main: LP_REWARDED_MAIN_AD_UNIT,
    rewarded_chat: LP_REWARDED_CHAT_AD_UNIT,
};

const scheduleAutoReload = (format: "interstitial" | "rewarded", tag: string) => {
    const adUnitId = TAG_TO_UNIT[tag];
    if (!adUnitId || pendingReload[tag]) return;
    pendingReload[tag] = setTimeout(() => {
        pendingReload[tag] = null;
        if (format === "interstitial") void LevelPlayAds.loadInterstitial({ adUnitId, tag });
        else void LevelPlayAds.loadRewarded({ adUnitId, tag });
    }, AD_RETRY_MS);
};

export const initAds = async (): Promise<void> => {
    if (!isNative()) return;
    if (lpInitialized) return;
    if (lpInitPromise) return lpInitPromise;

    lpInitPromise = (async () => {
        try {
            await LevelPlayAds.addListener("levelPlayEvent", (e: LevelPlayEvent) => {
                if (e.type === "loaded") {
                    lpReady[e.tag] = true;
                } else if (e.type === "failedToLoad") {
                    lpReady[e.tag] = false;
                    if (e.format === "interstitial" || e.format === "rewarded") {
                        scheduleAutoReload(e.format, e.tag);
                    }
                } else if (e.type === "displayFailed") {
                    lpReady[e.tag] = false;
                } else if (e.type === "closed") {
                    lpReady[e.tag] = false;
                }
            });

            await LevelPlayAds.initialize({ appKey: LEVELPLAY_APP_KEY });
            lpInitialized = true;

            void LevelPlayAds.loadInterstitial({ adUnitId: LP_INTERSTITIAL_MAIN_AD_UNIT, tag: "interstitial_main" });
            void LevelPlayAds.loadInterstitial({ adUnitId: LP_INTERSTITIAL_CHAT_AD_UNIT, tag: "interstitial_chat" });
            void LevelPlayAds.loadRewarded({ adUnitId: LP_REWARDED_MAIN_AD_UNIT, tag: "rewarded_main" });
            void LevelPlayAds.loadRewarded({ adUnitId: LP_REWARDED_CHAT_AD_UNIT, tag: "rewarded_chat" });
        } catch (e) {
            lpInitialized = false;
            lpInitPromise = null;
            console.error("[LevelPlay] init failed", e);
        }
    })();

    return lpInitPromise;
};

/* ============================================================
 * Interstitial
 * ============================================================ */
export const showInterstitial = async (variant: "main" | "chat" = "main"): Promise<boolean> => {
    if (!isNative()) return false;
    await initAds();

    const tag = variant === "chat" ? "interstitial_chat" : "interstitial_main";
    const adUnitId = variant === "chat" ? LP_INTERSTITIAL_CHAT_AD_UNIT : LP_INTERSTITIAL_MAIN_AD_UNIT;

    if (!lpReady[tag]) {
        // مش جاهز — نجرب نحمّله للمرة الجاية ونرجع false دلوقتي
        void LevelPlayAds.loadInterstitial({ adUnitId, tag });
        return false;
    }

    try {
        const shown = await new Promise<boolean>((resolve, reject) => {
            let handle: { remove: () => void } | null = null;
            LevelPlayAds.addListener("levelPlayEvent", (e) => {
                if (e.tag !== tag) return;
                if (e.type === "closed") {
                    handle?.remove();
                    resolve(true);
                }
                if (e.type === "displayFailed") {
                    handle?.remove();
                    reject(new Error(e.error || "displayFailed"));
                }
            }).then((h) => (handle = h));

            void LevelPlayAds.showInterstitial({ tag }).catch(reject);
        });
        reloadInterstitial(tag, adUnitId);
        return shown;
    } catch (e) {
        console.error("[LevelPlay] Interstitial show failed", e);
        reloadInterstitial(tag, adUnitId);
        return false;
    }
};

/* ============================================================
 * Interstitial — فحص جاهزية فوري (sync) عشان الكلاينت يقرر يحجب
 * شاشة اللغز أو لأ *قبل* ما يحاول يعرض أي حاجة. من غير الفحص ده،
 * أي محاولة عرض بتحصل وهي مش جاهزة كانت بتخلي شاشة "جارٍ عرض
 * الإعلان..." تفضل ظاهرة (أو تتكرر) من غير داعي.
 * ============================================================ */
export const isInterstitialReady = (variant: "main" | "chat" = "main"): boolean => {
    const tag = variant === "chat" ? "interstitial_chat" : "interstitial_main";
    return !!lpReady[tag];
};

/* ============================================================
 * Interstitial — نسخة "بوابة" (gate): بتتنادى بس لما isInterstitialReady
 * يكون true. بتعرض الإعلان وتستنى قفله (أو فشل العرض) وترجع فورًا —
 * من غير أي حلقة إعادة محاولة، عشان ميحصلش تجميد لشاشة سوداء لو
 * الإعلان مش موجود. لو مفيش إعلان جاهز أصلًا، الكود اللي بينادي
 * الدالة دي المفروض يتخطاها تمامًا ويكمل الألغاز عادي.
 * ============================================================ */
export const showInterstitialGate = async (
    variant: "main" | "chat" = "main"
): Promise<boolean> => {
    if (!isNative()) return false;
    await initAds();

    const tag = variant === "chat" ? "interstitial_chat" : "interstitial_main";
    const adUnitId = variant === "chat" ? LP_INTERSTITIAL_CHAT_AD_UNIT : LP_INTERSTITIAL_MAIN_AD_UNIT;

    if (!lpReady[tag]) {
        void LevelPlayAds.loadInterstitial({ adUnitId, tag });
        return false;
    }

    try {
        const shown = await new Promise<boolean>((resolve) => {
            let handle: { remove: () => void } | null = null;
            LevelPlayAds.addListener("levelPlayEvent", (e) => {
                if (e.tag !== tag) return;
                if (e.type === "closed") {
                    handle?.remove();
                    resolve(true);
                }
                if (e.type === "displayFailed") {
                    handle?.remove();
                    resolve(false);
                }
            }).then((h) => (handle = h));

            void LevelPlayAds.showInterstitial({ tag }).catch(() => resolve(false));
        });
        reloadInterstitial(tag, adUnitId);
        return shown;
    } catch (e) {
        console.error("[LevelPlay] Interstitial gate show failed", e);
        reloadInterstitial(tag, adUnitId);
        return false;
    }
};

/* ============================================================
 * Rewarded
 * ============================================================ */
export const showRewarded = async (
    opts?: { onStart?: () => void; onEnd?: () => void },
    variant: "main" | "chat" = "main"
): Promise<boolean> => {
    if (!isNative()) {
        console.log("[LevelPlay] Web Preview -> Reward Granted");
        opts?.onEnd?.();
        return true;
    }

    await initAds();

    const tag = variant === "chat" ? "rewarded_chat" : "rewarded_main";
    const adUnitId = variant === "chat" ? LP_REWARDED_CHAT_AD_UNIT : LP_REWARDED_MAIN_AD_UNIT;

    if (!lpReady[tag]) {
        void LevelPlayAds.loadRewarded({ adUnitId, tag });
        return false;
    }

    opts?.onStart?.();
    try {
        const earned = await new Promise<boolean>((resolve, reject) => {
            let rewarded = false;
            let handle: { remove: () => void } | null = null;
            LevelPlayAds.addListener("levelPlayEvent", (e) => {
                if (e.tag !== tag) return;
                if (e.type === "rewarded") rewarded = true;
                if (e.type === "closed") {
                    handle?.remove();
                    resolve(rewarded);
                }
                if (e.type === "displayFailed") {
                    handle?.remove();
                    reject(new Error(e.error || "displayFailed"));
                }
            }).then((h) => (handle = h));

            void LevelPlayAds.showRewarded({ tag }).catch(reject);
        });
        reloadRewarded(tag, adUnitId);
        opts?.onEnd?.();
        return earned;
    } catch (e) {
        console.error("[LevelPlay] Rewarded show failed", e);
        reloadRewarded(tag, adUnitId);
        opts?.onEnd?.();
        return false;
    }
};

/* ============================================================
 * Banner
 * ============================================================
 * البانر عنده listener خاص بيه بيعيد تحميله لوحده لو فشل (مفيش
 * إعادة محاولة كانت موجودة قبل كده — لو فشل تحميل أول مرة، كان
 * بيفضل فاضي للأبد وده كان سبب شائع لظهوره "مش شغال"). كمان بنمنع
 * أكتر من نداء showBanner متوازي في نفس الوقت.
 */
let bannerListenerAttached = false;
let bannerRetryTimer: ReturnType<typeof setTimeout> | null = null;
let bannerShouldBeVisible = false;
const BANNER_RETRY_MS = 15000;

const ensureBannerListener = async () => {
    if (bannerListenerAttached) return;
    bannerListenerAttached = true;
    await LevelPlayAds.addListener("levelPlayEvent", (e: LevelPlayEvent) => {
        if (e.format !== "banner") return;
        if (e.type === "failedToLoad" && bannerShouldBeVisible) {
            if (bannerRetryTimer) clearTimeout(bannerRetryTimer);
            bannerRetryTimer = setTimeout(() => {
                if (bannerShouldBeVisible) void showBannerAd();
            }, BANNER_RETRY_MS);
        }
    });
};

export const showBannerAd = async (opts?: { marginBottom?: number }) => {
    if (!isNative()) return;
    bannerShouldBeVisible = true;
    await initAds();
    await ensureBannerListener();

    try {
        await LevelPlayAds.showBanner({ adUnitId: LP_BANNER_AD_UNIT, marginBottom: opts?.marginBottom });
    } catch (e) {
        console.error("[LevelPlay] Banner show failed", e);
        if (bannerRetryTimer) clearTimeout(bannerRetryTimer);
        bannerRetryTimer = setTimeout(() => {
            if (bannerShouldBeVisible) void showBannerAd(opts);
        }, BANNER_RETRY_MS);
    }
};

export const hideBannerAd = async () => {
    bannerShouldBeVisible = false;
    if (bannerRetryTimer) {
        clearTimeout(bannerRetryTimer);
        bannerRetryTimer = null;
    }
    if (!isNative()) return;
    await LevelPlayAds.hideBanner().catch(() => {});
};

/* ============================================================
 * خيارات الخصوصية: مفيش Google UMP بعد إلغاء AdMob، فبدل نموذج
 * الخصوصية الرسمي بنمسح اختيار الموافقة المحفوظ ونعيد تحميل
 * التطبيق عشان نافذة AdsConsentDialog تظهر تاني ويقدر المستخدم
 * يغيّر اختياره (مخصصة / غير مخصصة).
 * ============================================================ */
export const showPrivacyOptions = async () => {
    if (!isNative()) {
        throw new Error("NOT_NATIVE");
    }
    localStorage.removeItem(CONSENT_KEY);
    window.location.reload();
};

/* ============================================================
 * عداد إعلانات الدردشة: إعلان فاصل (Interstitial) كل 10 رسائل
 * مُرسَلة، سواء في دردشة خاصة أو في جروب — عداد واحد مشترك بين
 * الاتنين. بيتخزن في localStorage عشان يفضل مستمر لو المستخدم قفل
 * التطبيق وفتحه تاني.
 * ============================================================ */
const CHAT_MSG_AD_INTERVAL = 10;
const CHAT_MSG_COUNTER_KEY = "chat_msg_ad_counter_v1";

let chatMessageCounter = (() => {
    try {
        return Number(localStorage.getItem(CHAT_MSG_COUNTER_KEY) || "0") || 0;
    } catch {
        return 0;
    }
})();

export const noteChatMessageSent = (): boolean => {
    chatMessageCounter += 1;
    try {
        localStorage.setItem(CHAT_MSG_COUNTER_KEY, String(chatMessageCounter));
    } catch {}
    return chatMessageCounter % CHAT_MSG_AD_INTERVAL === 0;
};
