import { Capacitor } from "@capacitor/core";

/* ============================================================
 *  AdMob unit IDs (production)
 * ============================================================ */
export const ADMOB_APP_ID = "ca-app-pub-4098736191122679~4275235624";
export const INTERSTITIAL_AD_ID = "ca-app-pub-4098736191122679/3034179835";
export const REWARDED_AD_ID = "ca-app-pub-4098736191122679/2165516995";
export const BANNER_AD_ID = "ca-app-pub-4098736191122679/7153504814";
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

        if (consent.isConsentFormAvailable && consent.status === "REQUIRED") {
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

            const { AdMob, InterstitialAdPluginEvents, RewardAdPluginEvents, BannerAdPosition, BannerAdSize } = await getAdMob();

            await requestUMPConsent();

            await AdMob.initialize({
                initializeForTesting: false,   // غيّر إلى true أثناء الاختبار
            });

            console.log("[AdMob] SDK initialized");

            // Register listeners once
            if (!listenersRegistered) {
                listenersRegistered = true;
                console.log("[AdMob] Registering listeners...");

                // Interstitial Listeners
                AdMob.addListener(InterstitialAdPluginEvents.Loaded, () => {
                    console.log("✅ Interstitial Loaded");
                    interstitialLoaded = true;
                    interstitialLoading = false;
                });

                AdMob.addListener(InterstitialAdPluginEvents.FailedToLoad, (e) => {
                    interstitialLoaded = false;
                    interstitialLoading = false;
                    logAdMobError("Interstitial Load", e);
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
                AdMob.addListener(RewardAdPluginEvents.Loaded, () => {
                    console.log("✅ Rewarded Loaded");
                    rewardedLoaded = true;
                    rewardedLoading = false;
                });

                AdMob.addListener(RewardAdPluginEvents.FailedToLoad, (e) => {
                    rewardedLoaded = false;
                    rewardedLoading = false;
                    logAdMobError("Rewarded Load", e);
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
            console.log("[AdMob] Preloading ads...");

            void prepareBanner();
            void preloadInterstitial();
            void preloadRewarded();

            console.log("✅ AdMob Ready");

        } catch (e) {
            initialized = false;
            initPromise = null;
            logAdMobError("Initialization", e);
            alert("AdMob initialization failed: " + (e?.message || e));
        }
    })();

    return initPromise;
};

/* ============================================================
 * PRELOADERS
 * ============================================================ */

export const prepareBanner = async () => {
    if (!isNative()) return;
    try {
        const { AdMob, BannerAdSize } = await getAdMob();
        console.log("[AdMob] Preparing Banner...");
        await AdMob.prepareBanner({
            adId: BANNER_AD_ID,
            adSize: BannerAdSize.ADAPTIVE_BANNER,
        });
        console.log("✅ Banner Prepared");
    } catch (e) {
        logAdMobError("Prepare Banner", e);
    }
};

export const preloadInterstitial = async () => {
    if (!isNative() || interstitialLoaded || interstitialLoading) return;

    interstitialLoading = true;
    console.log("[AdMob] Loading Interstitial...");

    try {
        const { AdMob } = await getAdMob();
        await AdMob.prepareInterstitial({ adId: INTERSTITIAL_AD_ID });
    } catch (e) {
        interstitialLoaded = false;
        logAdMobError("Preload Interstitial", e);
        alert("Interstitial Load Error: " + JSON.stringify(e, null, 2));
    } finally {
        interstitialLoading = false;
    }
};

export const preloadRewarded = async () => {
    if (!isNative() || rewardedLoaded || rewardedLoading) return;

    rewardedLoading = true;
    console.log("[AdMob] Loading Rewarded...");

    try {
        const { AdMob } = await getAdMob();
        await AdMob.prepareRewardVideoAd({ adId: REWARDED_AD_ID });   // تم التصحيح
    } catch (e) {
        rewardedLoaded = false;
        logAdMobError("Preload Rewarded", e);
        alert("Rewarded Load Error: " + JSON.stringify(e, null, 2));
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
        alert("Banner Show Error: " + (e?.message || e));
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
            alert("Interstitial Ad is not loaded");
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
        alert("Interstitial Error: " + (e?.message || e));
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
            opts?.onEnd?.();
            return false;
        }

        opts?.onStart?.();
        console.log("▶ Showing Rewarded");
        anyFullscreenAdShowing = true;

        await AdMob.showRewardVideoAd();
        console.log("✅ Rewarded Completed");
        return true;
    } catch (e) {
        logAdMobError("Show Rewarded", e);
        alert("Rewarded Error: " + (e?.message || e));
        return false;
    } finally {
        anyFullscreenAdShowing = false;
        rewardedLoaded = false;
        void preloadRewarded();
    }
};
