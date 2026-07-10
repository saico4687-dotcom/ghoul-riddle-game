import { Capacitor } from "@capacitor/core";

/* ============================================================
 *  AdMob unit IDs (production)
 * ============================================================ */
export const ADMOB_APP_ID = "ca-app-pub-4098736191122679~4275235624";
export const APP_OPEN_AD_ID = "ca-app-pub-4098736191122679/7200781863";
export const INTERSTITIAL_AD_ID = "ca-app-pub-4098736191122679/7153504814";
export const REWARDED_AD_ID = "ca-app-pub-4098736191122679/2165516995";
export const BANNER_AD_ID = "ca-app-pub-4098736191122679/3034179835";

/* App Open cooldown: only show on cold launch OR after 5h background */
const APP_OPEN_COOLDOWN_MS = 5 * 60 * 60 * 1000;
const LAST_APP_OPEN_KEY = "last_app_open_ad_v2";

/* ============================================================
 *  Internal state
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

/* Small helper to lazy import the plugin only on native */
async function getAdMob() {
  const mod = await import("@capacitor-community/admob");
  return mod;
}
const logAdMobError = (context: string, error: any) => {
  console.error(`[AdMob] ${context}`, {
    message: error?.message ?? "Unknown error",
    code: error?.code ?? "N/A",
    details: error?.details ?? error,
    stack: error?.stack ?? "No stack trace",
    raw: error,
  });
};
/* ============================================================
 *  UMP Consent
 * ============================================================ */
export const requestUMPConsent = async () => {
  if (!isNative()) return;
  try {
    const { AdMob } = await getAdMob();
    const consentInfo = await AdMob.requestConsentInfo();
    if (
      consentInfo.isConsentFormAvailable &&
      consentInfo.status === "REQUIRED"
    ) {
      await AdMob.showConsentForm();
    }
  } catch (e) {
    logAdMobError("consent failed", e);
  }
};

/* ============================================================
 *  Initialization (single-shot)
 * ============================================================ */
export const initAdMob = async (): Promise<void> => {
  if (initialized) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    if (!isNative()) {
      initialized = true;
      return;
    }

    try {
      const {
        AdMob,
        InterstitialAdPluginEvents,
        RewardAdPluginEvents,
      } = await getAdMob();

      await requestUMPConsent();

      await AdMob.initialize({
        initializeForTesting: false,
      });

      if (!listenersRegistered) {
        listenersRegistered = true;

        /* --- Interstitial --- */
        AdMob.addListener(InterstitialAdPluginEvents.Loaded, () => {
          interstitialLoaded = true;
          interstitialLoading = false;
          console.log("[AdMob] interstitial loaded");
        });
        AdMob.addListener(InterstitialAdPluginEvents.FailedToLoad, (e) => {
          interstitialLoaded = false;
          interstitialLoading = false;
          logAdMobError("interstitial failed to load", e);
        });
        AdMob.addListener(InterstitialAdPluginEvents.Showed, () => {
          anyFullscreenAdShowing = true;
        });
        AdMob.addListener(InterstitialAdPluginEvents.Dismissed, () => {
          anyFullscreenAdShowing = false;
          interstitialLoaded = false;
          void preloadInterstitial();
        });
        AdMob.addListener(InterstitialAdPluginEvents.FailedToShow, (e) => {
          anyFullscreenAdShowing = false;
          interstitialLoaded = false;
          logAdMobError("interstitial failed to show", e);
          void preloadInterstitial();
        });

        /* --- Rewarded --- */
        AdMob.addListener(RewardAdPluginEvents.Loaded, () => {
          rewardedLoaded = true;
          rewardedLoading = false;
          console.log("[AdMob] rewarded loaded");
        });
        AdMob.addListener(RewardAdPluginEvents.FailedToLoad, (e) => {
          rewardedLoaded = false;
          rewardedLoading = false;
          logAdMobError("rewarded failed to load", e);
        });
        AdMob.addListener(RewardAdPluginEvents.Showed, () => {
          anyFullscreenAdShowing = true;
        });
        AdMob.addListener(RewardAdPluginEvents.Dismissed, () => {
          anyFullscreenAdShowing = false;
          rewardedLoaded = false;
          void preloadRewarded();
        });
        AdMob.addListener(RewardAdPluginEvents.FailedToShow, (e) => {
          anyFullscreenAdShowing = false;
          rewardedLoaded = false;
          logAdMobError("rewarded failed to show", e);
          void preloadRewarded();
        });

        /* App Open is served through the stable interstitial API in this plugin version. */
      }

      initialized = true;

      /* Warm up all caches */
      void preloadInterstitial();
      void preloadRewarded();
      void preloadAppOpen();

      console.log("[AdMob] initialized");
    } catch (e) {
      logAdMobError("initialization failed", e);
      initialized = false;
      initPromise = null;
    }
  })();

  return initPromise;
};

/* ============================================================
 *  Preloaders
 * ============================================================ */
export const preloadInterstitial = async () => {
  if (!isNative()) return;
  if (interstitialLoaded || interstitialLoading) return;
  interstitialLoading = true;
  try {
    const { AdMob } = await getAdMob();
    await AdMob.prepareInterstitial({ adId: INTERSTITIAL_AD_ID });
    interstitialLoaded = true;
  } catch (e) {
    interstitialLoading = false;
    logAdMobError("preload interstitial failed", e);
  } finally {
    interstitialLoading = false;
  }
};

export const preloadRewarded = async () => {
  if (!isNative()) return;
  if (rewardedLoaded || rewardedLoading) return;
  rewardedLoading = true;
  try {
    const { AdMob } = await getAdMob();
    await AdMob.prepareRewardVideoAd({ adId: REWARDED_AD_ID });
    rewardedLoaded = true;
  } catch (e) {
    rewardedLoading = false;
    logAdMobError("preload rewarded failed", e);
  } finally {
    rewardedLoading = false;
  }
};

export const preloadAppOpen = async () => {
  if (!isNative()) return;
  if (appOpenLoaded || appOpenLoading) return;
  appOpenLoading = true;
  try {
    const { AdMob } = await getAdMob();
    await AdMob.prepareInterstitial({ adId: APP_OPEN_AD_ID });
    appOpenLoaded = true;
  } catch (e) {
    appOpenLoading = false;
    logAdMobError("preload app-open failed", e);
  } finally {
    appOpenLoading = false;
  }
};

/* ============================================================
 *  App Open
 * ============================================================ */
export const showAppOpenAdIfDue = async () => {
  if (!isNative()) return;
  if (anyFullscreenAdShowing) return;

  const last = Number(localStorage.getItem(LAST_APP_OPEN_KEY) || 0);
  if (Date.now() - last < APP_OPEN_COOLDOWN_MS) return;

  try {
    await initAdMob();
    const { AdMob } = await getAdMob();

    if (!appOpenLoaded) await preloadAppOpen();
    if (!appOpenLoaded) {
  console.error("[AdMob] App Open is not loaded.");
  return;
    }

    anyFullscreenAdShowing = true;
    await AdMob.showInterstitial();
    anyFullscreenAdShowing = false;
    appOpenLoaded = false;
    void preloadAppOpen();
    localStorage.setItem(LAST_APP_OPEN_KEY, String(Date.now()));
  } catch (e) {
    anyFullscreenAdShowing = false;
    appOpenLoaded = false;
    logAdMobError("show app-open failed", e);
  }
};

/* ============================================================
 *  Interstitial
 * ============================================================ */
export const showInterstitial = async (): Promise<boolean> => {
  if (!isNative()) return false;
  if (anyFullscreenAdShowing) return false;

  try {
    await initAdMob();
    const { AdMob } = await getAdMob();

    if (!interstitialLoaded) {
      await preloadInterstitial();
    }
    if (!interstitialLoaded) {
  console.error("[AdMob] Interstitial is not loaded.");
  return false;
    }

    anyFullscreenAdShowing = true;
    await AdMob.showInterstitial();
    anyFullscreenAdShowing = false;
    interstitialLoaded = false;
    void preloadInterstitial();
    return true;
  } catch (e) {
    anyFullscreenAdShowing = false;
    interstitialLoaded = false;
    logAdMobError("show interstitial failed", e);
    return false;
  }
};

/* ============================================================
 *  Rewarded — always grants reward on failure
 * ============================================================ */
export const showRewarded = async (opts?: {
  onStart?: () => void;
  onEnd?: () => void;
}): Promise<boolean> => {
  if (!isNative()) {
    // Web preview: grant reward without ad
    return true;
  }
  if (anyFullscreenAdShowing) {
    // Never overlap with another fullscreen ad
    return true;
  }

  try {
    await initAdMob();
    const { AdMob } = await getAdMob();

    if (!rewardedLoaded) {
      await preloadRewarded();
    }

    opts?.onStart?.();

    if (!rewardedLoaded) {
  console.error("[AdMob] Rewarded is not loaded.");
  opts?.onEnd?.();
  return true;
    }

    try {
      await AdMob.showRewardVideoAd();
    } catch (e) {
      logAdMobError("rewarded show error", e);
    } finally {
      rewardedLoaded = false;
      anyFullscreenAdShowing = false;
      void preloadRewarded();
    }

    opts?.onEnd?.();
    return true;
  } catch (e) {
    logAdMobError("rewarded error", e);
    opts?.onEnd?.();
    return true;
  }
};

/* ============================================================
 *  Banner (adaptive, bottom-center)
 * ============================================================ */
export const showBannerAd = async () => {
  if (!isNative()) return;
  if (bannerVisible) return;

  try {
    await initAdMob();
    const { AdMob, BannerAdPosition, BannerAdSize } = await getAdMob();

    await AdMob.showBanner({
      adId: BANNER_AD_ID,
      adSize: BannerAdSize.ADAPTIVE_BANNER,
      position: BannerAdPosition.BOTTOM_CENTER,
      margin: 0,
    });

    bannerVisible = true;
  } catch (e) {
    logAdMobError("banner show failed", e);
  }
};

export const hideBannerAd = async () => {
  if (!isNative()) return;
  if (!bannerVisible) return;

  try {
    const { AdMob } = await getAdMob();
    await AdMob.removeBanner();
  } catch (e) {
    logAdMobError("banner hide failed", e);
  } finally {
    bannerVisible = false;
  }
};
