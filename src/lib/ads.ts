import { Capacitor } from "@capacitor/core";

/* ============================================================
 *  AdMob unit IDs (production)
 * ============================================================ */
export const ADMOB_APP_ID = "ca-app-pub-4098736191122679~4275235624";
export const INTERSTITIAL_AD_ID = "ca-app-pub-4098736191122679/7153504814";
export const REWARDED_AD_ID = "ca-app-pub-4098736191122679/2165516995";
export const BANNER_AD_ID = "ca-app-pub-4098736191122679/3034179835";

/* ============================================================
 * Internal State
 * ============================================================ */

let initialized = false;
let initPromise: Promise<void> | null = null;

let interstitialLoaded = false;
let interstitialLoading = false;

let rewardedLoaded = false;
let rewardedLoading = false;

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
            initialized = true;
            console.log("[AdMob] Running on Web.");
            return;
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

    } catch (e) {

        interstitialLoaded = false;

        logAdMobError("Preload Interstitial", e);
        
        alert(JSON.stringify(e, null, 2));

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

    } catch (e) {

        rewardedLoaded = false;

        logAdMobError("Preload Rewarded", e);

        alert(JSON.stringify(e, null, 2));

    } finally {

        rewardedLoading = false;

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

        alert(e instanceof Error ? e.message : String(e));

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

            alert(e instanceof Error ? e.message : String(e));

            void preloadRewarded();

            opts?.onEnd?.();

            return false;

        }

    } catch (e) {

        rewardedLoaded = false;

        anyFullscreenAdShowing = false;

        logAdMobError("Rewarded Error", e);

        alert(e instanceof Error ? e.message : String(e));

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

        alert(e instanceof Error ? e.message : String(e));

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

        alert(JSON.stringify(e, null, 2));

    } finally {

        bannerVisible = false;

    }

};
