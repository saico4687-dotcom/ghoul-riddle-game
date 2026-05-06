import { Capacitor } from "@capacitor/core";

// AdMob IDs
export const ADMOB_APP_ID = "ca-app-pub-4098736191122679~4275235624";
export const APP_OPEN_AD_ID = "ca-app-pub-4098736191122679/7200781863";
export const INTERSTITIAL_AD_ID = "ca-app-pub-4098736191122679/2275758241";
export const REWARDED_AD_ID = "ca-app-pub-4098736191122679/6048921683";

const FIVE_HOURS = 5 * 60 * 60 * 1000;
const LAST_APP_OPEN_KEY = "last_app_open_ad";

let initialized = false;

/**
 * Request Google UMP (User Messaging Platform) consent — required by Google
 * Play & EEA/UK GDPR. Falls back gracefully on web.
 */
export const requestUMPConsent = async () => {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const { AdMob } = await import("@capacitor-community/admob");
    const consentInfo = await AdMob.requestConsentInfo();
    if (
      consentInfo.isConsentFormAvailable &&
      consentInfo.status === "REQUIRED"
    ) {
      await AdMob.showConsentForm();
    }
  } catch (e) {
    console.warn("[AdMob] UMP consent failed", e);
  }
};

export const initAdMob = async () => {
  if (initialized) return;
  if (!Capacitor.isNativePlatform()) {
    initialized = true;
    return;
  }
  try {
    const { AdMob } = await import("@capacitor-community/admob");
    // 1) Ask for GDPR/UMP consent BEFORE initializing ads
    await requestUMPConsent();
    // 2) Initialize AdMob (production mode)
    await AdMob.initialize({ initializeForTesting: false });
    // 3) Tracking authorization (iOS ATT) — no-op on Android
    try {
      const tracking = await AdMob.trackingAuthorizationStatus();
      if (tracking.status === "notDetermined") {
        await AdMob.requestTrackingAuthorization();
      }
    } catch {}
    initialized = true;
  } catch (e) {
    console.warn("[AdMob] init failed", e);
  }
};

/** App-open ad — shown at most every 5 hours. */
export const showAppOpenAdIfDue = async () => {
  if (!Capacitor.isNativePlatform()) return;
  const last = Number(localStorage.getItem(LAST_APP_OPEN_KEY) || 0);
  if (Date.now() - last < FIVE_HOURS) return;
  try {
    await initAdMob();
    const { AdMob } = await import("@capacitor-community/admob");
    // App-open uses interstitial-style API in this plugin
    await AdMob.prepareInterstitial({ adId: APP_OPEN_AD_ID });
    await AdMob.showInterstitial();
    localStorage.setItem(LAST_APP_OPEN_KEY, String(Date.now()));
  } catch (e) {
    console.warn("[AdMob] app-open failed", e);
  }
};

export const showInterstitial = async () => {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await initAdMob();
    const { AdMob } = await import("@capacitor-community/admob");
    await AdMob.prepareInterstitial({ adId: INTERSTITIAL_AD_ID });
    await AdMob.showInterstitial();
  } catch (e) {
    console.warn("[AdMob] interstitial failed", e);
  }
};

/**
 * Rewarded ad. Resolves to true only if the user earned the reward.
 * On web/preview returns true so dev flow keeps working.
 */
export const showRewarded = async (): Promise<boolean> => {
  if (!Capacitor.isNativePlatform()) return true;
  try {
    await initAdMob();
    const { AdMob, RewardAdPluginEvents } = await import("@capacitor-community/admob");

    let earned = false;
    const listener = await AdMob.addListener(RewardAdPluginEvents.Rewarded, () => {
      earned = true;
    });

    await AdMob.prepareRewardVideoAd({ adId: REWARDED_AD_ID });
    await AdMob.showRewardVideoAd();

    listener.remove();
    return earned;
  } catch (e) {
    console.warn("[AdMob] rewarded failed", e);
    return false;
  }
};
