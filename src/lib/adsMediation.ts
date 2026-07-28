import {
    initAdMob,
    showBannerAd as admobShowBanner,
    hideBannerAd as admobHideBanner,
    showInterstitial as admobShowInterstitial,
    showRewarded as admobShowRewarded,
    isInterstitialReady as admobInterstitialReady,
    isRewardedReady as admobRewardedReady,
    noteChatMessageSent,
    requestUMPConsent,
    showPrivacyOptions,
    openAdInspector,
    setAdsPersonalization,
    CONSENT_KEY,
} from "./ads";

import { LevelPlayAds, isNative, LevelPlayEvent, LevelPlayFormat } from "./levelplayAds";

// بنمرر الدوال دي زي ما هي بالظبط من غير أي تغيير
export {
    noteChatMessageSent,
    requestUMPConsent,
    showPrivacyOptions,
    openAdInspector,
    setAdsPersonalization,
    CONSENT_KEY,
};

/* ============================================================
 * إعدادات ironSource / Unity LevelPlay
 * ============================================================ */
const LEVELPLAY_APP_KEY = "275ab5f05";

const LP_BANNER_AD_UNIT = "knkysfwy8lg9cv37";
const LP_INTERSTITIAL_MAIN_AD_UNIT = "75c2gz1s0rkeaqja";
const LP_INTERSTITIAL_CHAT_AD_UNIT = "44okuay8c4lvv5us";
const LP_REWARDED_MAIN_AD_UNIT = "8687xc91zz0g0jbb";
const LP_REWARDED_CHAT_AD_UNIT = "bk6q4274l0mg6x3r";

/* ============================================================
 * تقييم "السعر" لكل شبكة/فورمات:
 * - ironSource: بيترصد فعليًا من قيمة "revenue" الحقيقية اللي
 *   بترجع مع كل إعلان يتحمّل (متوسط متحرك EMA عشان يبقى مستقر).
 * - AdMob: لسه مفيش عندنا قراءة سعر حقيقي منه (محتاجة تعديل إضافي
 *   على مستوى الـ plugin نفسه)، فمستخدمين تقدير ثابت قابل للتعديل.
 *   لو عايزة نضيف قراءة حقيقية من AdMob كمان تقوليلي وهنضيفها.
 * ============================================================ */
const ADMOB_DEFAULT_SCORE: Record<LevelPlayFormat, number> = {
    interstitial: 0.01,
    rewarded: 0.02,
    banner: 0.003,
};

const SCORE_KEY = "ads_mediation_scores_v1";
type Scores = Record<string, number>;

const loadScores = (): Scores => {
    try {
        return JSON.parse(localStorage.getItem(SCORE_KEY) || "{}");
    } catch {
        return {};
    }
};

const saveScores = (scores: Scores) => {
    try {
        localStorage.setItem(SCORE_KEY, JSON.stringify(scores));
    } catch {}
};

const updateScore = (key: string, revenue: number) => {
    if (!revenue || revenue <= 0) return;
    const scores = loadScores();
    const prev = scores[key];
    scores[key] = prev == null ? revenue : prev * 0.7 + revenue * 0.3;
    saveScores(scores);
};

const getLpScore = (format: LevelPlayFormat) => loadScores()[`levelplay_${format}`] ?? 0;
const getAdmobScore = (format: LevelPlayFormat) =>
    loadScores()[`admob_${format}`] ?? ADMOB_DEFAULT_SCORE[format];

/* ============================================================
 * حالة جاهزية إعلانات ironSource (بالـ tag: interstitial_main،
 * interstitial_chat، rewarded_main، rewarded_chat، banner)
 * ============================================================ */
const lpReady: Record<string, boolean> = {};

let lpInitialized = false;
let lpInitPromise: Promise<void> | null = null;

const reloadLpInterstitial = (tag: string, adUnitId: string) => {
    lpReady[tag] = false;
    void LevelPlayAds.loadInterstitial({ adUnitId, tag });
};

const reloadLpRewarded = (tag: string, adUnitId: string) => {
    lpReady[tag] = false;
    void LevelPlayAds.loadRewarded({ adUnitId, tag });
};

const initLevelPlay = async (): Promise<void> => {
    if (!isNative()) return;
    if (lpInitialized) return;
    if (lpInitPromise) return lpInitPromise;

    lpInitPromise = (async () => {
        try {
            await LevelPlayAds.addListener("levelPlayEvent", (e: LevelPlayEvent) => {
                if (e.type === "loaded") {
                    lpReady[e.tag] = true;
                    if (typeof e.revenue === "number") {
                        updateScore(`levelplay_${e.format}`, e.revenue);
                    }
                } else if (e.type === "failedToLoad" || e.type === "displayFailed") {
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
            console.error("[LevelPlay] init failed", e);
        }
    })();

    return lpInitPromise;
};

export const initAds = async (): Promise<void> => {
    await Promise.all([initAdMob(), initLevelPlay()]);
};

/* ============================================================
 * "المزاد": مين يظهر الأول؟
 * - الاتنين جاهزين → اللي متوسط سعره أعلى (بيتحسب فعليًا من بيانات
 *   حقيقية بمرور الوقت).
 * - واحد بس جاهز → هو اللي يظهر.
 * - محدش جاهز → مفيش إعلان.
 * ============================================================ */
const decideWinner = (
    admobReady: boolean,
    lpReadyFlag: boolean,
    format: LevelPlayFormat
): "admob" | "levelplay" | null => {
    if (admobReady && lpReadyFlag) {
        return getAdmobScore(format) >= getLpScore(format) ? "admob" : "levelplay";
    }
    if (admobReady) return "admob";
    if (lpReadyFlag) return "levelplay";
    return null;
};

/* ============================================================
 * Interstitial
 * ============================================================ */
export const showInterstitial = async (variant: "main" | "chat" = "main"): Promise<boolean> => {
    await initAds();

    const tag = variant === "chat" ? "interstitial_chat" : "interstitial_main";
    const adUnitId = variant === "chat" ? LP_INTERSTITIAL_CHAT_AD_UNIT : LP_INTERSTITIAL_MAIN_AD_UNIT;

    const winner = decideWinner(admobInterstitialReady(), !!lpReady[tag], "interstitial");

    if (winner === "levelplay") {
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
            reloadLpInterstitial(tag, adUnitId);
            return shown;
        } catch (e) {
            console.error("[LevelPlay] Interstitial show failed, falling back to AdMob", e);
            return admobShowInterstitial();
        }
    }

    if (winner === "admob") {
        return admobShowInterstitial();
    }

    // محدش جاهز — نجرب نحمّل ironSource للمرة الجاية، وAdMob بيحاول
    // بنفسه (بيعمل preload تلقائي جوه showInterstitial بتاعته)
    void LevelPlayAds.loadInterstitial({ adUnitId, tag });
    return admobShowInterstitial();
};

/* ============================================================
 * Rewarded
 * ============================================================ */
export const showRewarded = async (
    opts?: { onStart?: () => void; onEnd?: () => void },
    variant: "main" | "chat" = "main"
): Promise<boolean> => {
    await initAds();

    const tag = variant === "chat" ? "rewarded_chat" : "rewarded_main";
    const adUnitId = variant === "chat" ? LP_REWARDED_CHAT_AD_UNIT : LP_REWARDED_MAIN_AD_UNIT;

    const winner = decideWinner(admobRewardedReady(), !!lpReady[tag], "rewarded");

    if (winner === "levelplay") {
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
            reloadLpRewarded(tag, adUnitId);
            opts?.onEnd?.();
            return earned;
        } catch (e) {
            console.error("[LevelPlay] Rewarded show failed, falling back to AdMob", e);
            return admobShowRewarded(opts);
        }
    }

    return admobShowRewarded(opts);
};

/* ============================================================
 * Banner
 * ============================================================ */
export const showBannerAd = async (opts?: { marginBottom?: number }) => {
    await initAds();

    if (!!lpReady["banner"] && getLpScore("banner") > getAdmobScore("banner")) {
        try {
            await LevelPlayAds.showBanner({ adUnitId: LP_BANNER_AD_UNIT, marginBottom: opts?.marginBottom });
            return;
        } catch (e) {
            console.error("[LevelPlay] Banner show failed, falling back to AdMob", e);
        }
    }

    // مفيش تأكيد لسه إن بانر LevelPlay فعلاً حمّل بنجاح، فبنعرض AdMob
    // كخيار مضمون دايمًا. وبنجرب LevelPlay في الخلفية بالتوازي: لو نجح
    // فعلاً، حدث "loaded" الحقيقي (معالَج فوق في initLevelPlay) هو اللي
    // بيحدّث lpReady["banner"] — مش مجرد إن الـ promise اترجع، عشان
    // كانت بترجع "نجاح" حتى لو التحميل فشل فعليًا وده كان بيمنع أي
    // fallback حقيقي لـ AdMob في المرة الجاية.
    void admobShowBanner(opts);
    if (isNative()) {
        void LevelPlayAds.showBanner({ adUnitId: LP_BANNER_AD_UNIT, marginBottom: opts?.marginBottom }).catch(() => {});
    }
};

export const hideBannerAd = async () => {
    await Promise.all([admobHideBanner(), LevelPlayAds.hideBanner().catch(() => {})]);
};
