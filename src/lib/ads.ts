import { Capacitor } from "@capacitor/core";

/* ============================================================
 *  AdMob unit IDs (production)
 * ============================================================ */
export const ADMOB_APP_ID = "ca-app-pub-4098736191122679~4275235624";
export const APP_OPEN_AD_ID = "ca-app-pub-4098736191122679/7200781863";
export const INTERSTITIAL_AD_ID = "ca-app-pub-4098736191122679/7153504814";
export const REWARDED_AD_ID = "ca-app-pub-4098736191122679/2165516995";
export const BANNER_AD_ID = "ca-app-pub-4098736191122679/3034179835";

/* ============================================================
 * App Open cooldown
 * ============================================================ */
const APP_OPEN_COOLDOWN_MS = 5 * 60 * 60 * 1000;
const LAST_APP_OPEN_KEY = "last_app_open_ad_v2";

/* ============================================================
 * Internal State
 * ============================================================ */

let initialized = false;
let initPromise: Promise<void> | null = null;

let interstitialLoaded = false;
let interstitialLoading = false;

let rewardedLoaded = false;
let rewardedLoading = false;

let appOpenLoaded = false;
let appOpenLoading = false;

let bannerVisible = false;
let anyFullscreenAdShowing = false;

let listenersRegistered = false;

const isNative = () => Capacitor.isNativePlatform();

async function getAdMob() {
    return await import("@capacitor-community/admob");
}

const logAdMobError = (context: string, error: any) => {
    console.error(`❌ [AdMob] ${context}`, {
        message: error?.message ?? "Unknown Error",
        code: error?.code ?? "N/A",
        details: error?.details ?? error,
        stack: error?.stack,
        raw: error,
    });
};

/* ============================================================
 * UMP Consent
 * ============================================================ */

export const requestUMPConsent = async () => {

    if (!isNative()) return;

    try {

        const { AdMob } = await getAdMob();

        console.log("[AdMob] Requesting consent...");

        const consent = await AdMob.requestConsentInfo();

        console.log("[AdMob] Consent Status:", consent);

        if (
            consent.isConsentFormAvailable &&
            consent.status === "REQUIRED"
        ) {

            console.log("[AdMob] Showing consent form...");

            await AdMob.showConsentForm();
        }

    } catch (e) {

        logAdMobError("Consent", e);

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
    console.warn("[AdMob] Rewarded ads are only available on native Android.");
    return false;
        }

        }

        try {

            console.log("[AdMob] Initializing...");

            const {

                AdMob,

                InterstitialAdPluginEvents,

                RewardAdPluginEvents,

            } = await getAdMob();

            await requestUMPConsent();

            await AdMob.initialize({

                initializeForTesting: false,

            });

            console.log("[AdMob] SDK initialized");

            if (!listenersRegistered) {

                listenersRegistered = true;

                console.log("[AdMob] Registering listeners...");

                /* ==========================
                   INTERSTITIAL
                =========================== */

                AdMob.addListener(
                    InterstitialAdPluginEvents.Loaded,
                    () => {

                        console.log("✅ Interstitial Loaded");

                        interstitialLoaded = true;

                        interstitialLoading = false;

                    }
                );

                AdMob.addListener(
                    InterstitialAdPluginEvents.FailedToLoad,
                    (e) => {

                        interstitialLoaded = false;

                        interstitialLoading = false;

                        logAdMobError("Interstitial Load", e);

                    }
                );

                AdMob.addListener(
                    InterstitialAdPluginEvents.Showed,
                    () => {

                        console.log("✅ Interstitial Showed");

                        anyFullscreenAdShowing = true;

                    }
                );

                AdMob.addListener(
                    InterstitialAdPluginEvents.Dismissed,
                    () => {

                        console.log("✅ Interstitial Closed");

                        anyFullscreenAdShowing = false;

                        interstitialLoaded = false;

                        void preloadInterstitial();

                    }
                );

                AdMob.addListener(
                    InterstitialAdPluginEvents.FailedToShow,
                    (e) => {

                        anyFullscreenAdShowing = false;

                        interstitialLoaded = false;

                        logAdMobError("Interstitial Show", e);

                        void preloadInterstitial();

                    }
                );

                /* ==========================
                   REWARDED
                =========================== */

                AdMob.addListener(
                    RewardAdPluginEvents.Loaded,
                    () => {

                        console.log("✅ Rewarded Loaded");

                        rewardedLoaded = true;

                        rewardedLoading = false;

                    }
                );

                AdMob.addListener(
                    RewardAdPluginEvents.FailedToLoad,
                    (e) => {

                        rewardedLoaded = false;

                        rewardedLoading = false;

                        logAdMobError("Rewarded Load", e);

                    }
                );

                AdMob.addListener(
                    RewardAdPluginEvents.Showed,
                    () => {

                        console.log("✅ Rewarded Showed");

                        anyFullscreenAdShowing = true;

                    }
                );

                AdMob.addListener(
                    RewardAdPluginEvents.Dismissed,
                    () => {

                        console.log("✅ Rewarded Closed");

                        anyFullscreenAdShowing = false;

                        rewardedLoaded = false;

                        void preloadRewarded();

                    }
                );

                AdMob.addListener(
                    RewardAdPluginEvents.FailedToShow,
                    (e) => {

                        anyFullscreenAdShowing = false;

                        rewardedLoaded = false;

                        logAdMobError("Rewarded Show", e);

                        void preloadRewarded();

                    }
                );

            }

            initialized = true;

            console.log("[AdMob] Preloading ads...");

            void preloadInterstitial();
            void preloadRewarded();
            void preloadAppOpen();

            console.log("✅ AdMob Ready");

        } catch (e) {

            initialized = false;

            initPromise = null;

            logAdMobError("Initialization", e);

            alert("AdMob initialization failed");

        }

    })();

    return initPromise;

};
/* ============================================================
 * PRELOADERS
 * ============================================================ */

export const preloadInterstitial = async () => {

    if (!isNative()) return;

    if (interstitialLoaded || interstitialLoading) return;

    interstitialLoading = true;

    console.log("[AdMob] Loading Interstitial...");

    try {

        const { AdMob } = await getAdMob();

        await AdMob.prepareInterstitial({
            adId: INTERSTITIAL_AD_ID,
        });

        interstitialLoaded = true;

        console.log("✅ Interstitial Ready");

    } catch (e) {

        interstitialLoaded = false;

        logAdMobError("Preload Interstitial", e);

    } finally {

        interstitialLoading = false;

    }

};

export const preloadRewarded = async () => {

    if (!isNative()) return;

    if (rewardedLoaded || rewardedLoading) return;

    rewardedLoading = true;

    console.log("[AdMob] Loading Rewarded...");

    try {

        const { AdMob } = await getAdMob();

        await AdMob.prepareRewardVideoAd({
            adId: REWARDED_AD_ID,
        });

        rewardedLoaded = true;

        console.log("✅ Rewarded Ready");

    } catch (e) {

        rewardedLoaded = false;

        logAdMobError("Preload Rewarded", e);

    } finally {

        rewardedLoading = false;

    }

};

export const preloadAppOpen = async () => {

    if (!isNative()) return;

    if (appOpenLoaded || appOpenLoading) return;

    appOpenLoading = true;

    console.log("[AdMob] Loading App Open...");

    try {

        const { AdMob } = await getAdMob();

        await AdMob.prepareInterstitial({

            adId: APP_OPEN_AD_ID,

        });

        appOpenLoaded = true;

        console.log("✅ App Open Ready");

    } catch (e) {

        appOpenLoaded = false;

        logAdMobError("Preload App Open", e);

    } finally {

        appOpenLoading = false;

    }

};

/* ============================================================
 * APP OPEN
 * ============================================================ */

export const showAppOpenAdIfDue = async () => {

    if (!isNative()) return;

    if (anyFullscreenAdShowing) {

        console.warn("[AdMob] Another fullscreen ad is already showing.");

        return;

    }

    const last = Number(localStorage.getItem(LAST_APP_OPEN_KEY) || 0);

    if (Date.now() - last < APP_OPEN_COOLDOWN_MS) {

        console.log("[AdMob] App Open Cooldown");

        return;

    }

    try {

        await initAdMob();

        const { AdMob } = await getAdMob();

        if (!appOpenLoaded) {

            await preloadAppOpen();

        }

        if (!appOpenLoaded) {

            console.error("[AdMob] App Open NOT Loaded");

            alert("App Open Ad is not loaded");

            return;

        }

        console.log("▶ Showing App Open");

        anyFullscreenAdShowing = true;

        await AdMob.showInterstitial();

        console.log("✅ App Open Finished");

        appOpenLoaded = false;

        anyFullscreenAdShowing = false;

        localStorage.setItem(

            LAST_APP_OPEN_KEY,

            String(Date.now())

        );

        void preloadAppOpen();

    } catch (e) {

        anyFullscreenAdShowing = false;

        appOpenLoaded = false;

        logAdMobError("Show App Open", e);

        alert(JSON.stringify(e));

    }

};

/* ============================================================
 * INTERSTITIAL
 * ============================================================ */

export const showInterstitial = async (): Promise<boolean> => {

    if (!isNative()) return false;

    if (anyFullscreenAdShowing) {

        console.warn("[AdMob] Another fullscreen ad is already showing.");

        return false;

    }

    try {

        await initAdMob();

        const { AdMob } = await getAdMob();

        if (!interstitialLoaded) {

            await preloadInterstitial();

        }

        if (!interstitialLoaded) {

            console.error("[AdMob] Interstitial NOT Loaded");

            alert("Interstitial Ad is not loaded");

            return false;

        }

        console.log("▶ Showing Interstitial");

        anyFullscreenAdShowing = true;

        await AdMob.showInterstitial();

        console.log("✅ Interstitial Finished");

        anyFullscreenAdShowing = false;

        interstitialLoaded = false;

        void preloadInterstitial();

        return true;

    } catch (e) {

        anyFullscreenAdShowing = false;

        interstitialLoaded = false;

        logAdMobError("Show Interstitial", e);

        alert(JSON.stringify(e));

        return false;

    }

};
/* ============================================================
 * REWARDED
 * ============================================================ */

export const showRewarded = async (opts?: {
    onStart?: () => void;
    onEnd?: () => void;
}): Promise<boolean> => {

    if (!isNative()) {
        console.log("[AdMob] Web Preview -> Reward Granted");
        return true;
    }

    if (anyFullscreenAdShowing) {
        console.warn("[AdMob] Another fullscreen ad is already showing.");
        return false;
    }

    try {

        await initAdMob();

        const { AdMob } = await getAdMob();

        if (!rewardedLoaded) {

            console.log("[AdMob] Rewarded not loaded, preparing...");

            await preloadRewarded();

        }

        if (!rewardedLoaded) {

            console.error("[AdMob] Rewarded NOT Loaded");

            alert("Rewarded Ad is not loaded");

            opts?.onEnd?.();

            return false;

        }

        opts?.onStart?.();

        console.log("▶ Showing Rewarded");

        anyFullscreenAdShowing = true;

        try {

            await AdMob.showRewardVideoAd();

            console.log("✅ Rewarded Completed");

            rewardedLoaded = false;

            anyFullscreenAdShowing = false;

            void preloadRewarded();

            opts?.onEnd?.();

            return true;

        } catch (e) {

            rewardedLoaded = false;

            anyFullscreenAdShowing = false;

            logAdMobError("Rewarded Show", e);

            alert(JSON.stringify(e));

            void preloadRewarded();

            opts?.onEnd?.();

            return false;

        }

    } catch (e) {

        rewardedLoaded = false;

        anyFullscreenAdShowing = false;

        logAdMobError("Rewarded Error", e);

        alert(JSON.stringify(e));

        opts?.onEnd?.();

        return false;

    }

};

/* ============================================================
 * BANNER
 * ============================================================ */

export const showBannerAd = async () => {

    if (!isNative()) return;

    if (bannerVisible) return;

    try {

        await initAdMob();

        const {

            AdMob,

            BannerAdPosition,

            BannerAdSize,

        } = await getAdMob();

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

        alert(JSON.stringify(e));

    }

};

export const hideBannerAd = async () => {

    if (!isNative()) return;

    if (!bannerVisible) return;

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
