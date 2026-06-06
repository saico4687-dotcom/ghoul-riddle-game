import { Capacitor } from "@capacitor/core";

export const ADMOB_APP_ID = "ca-app-pub-4098736191122679~4275235624";
export const APP_OPEN_AD_ID = "ca-app-pub-4098736191122679/7200781863";
export const INTERSTITIAL_AD_ID = "ca-app-pub-4098736191122679/2275758241";
export const REWARDED_AD_ID = "ca-app-pub-4098736191122679/6048921683";

const FIVE_HOURS = 5 * 60 * 60 * 1000;
const LAST_APP_OPEN_KEY = "last_app_open_ad";

let initialized = false;

export const requestUMPConsent = async () => {
  if (!Capacitor.isNativePlatform()) return;

  try {
    const { AdMob } = await import("@capacitor-community/admob");

    const consentInfo = await AdMob.requestConsentInfo();

    if (consentInfo.isConsentFormAvailable && consentInfo.status === "REQUIRED") {
      await AdMob.showConsentForm();
    }
  } catch (e) {
    console.warn("[AdMob] consent failed", e);
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

    await requestUMPConsent();

    await AdMob.initialize({
      initializeForTesting: false,
    });

    initialized = true;
  } catch (e) {
    console.warn("[AdMob] init failed", e);
  }
};

export const showAppOpenAdIfDue = async () => {
  if (!Capacitor.isNativePlatform()) return;

  const last = Number(localStorage.getItem(LAST_APP_OPEN_KEY) || 0);
  if (Date.now() - last < FIVE_HOURS) return;

  try {
    await initAdMob();

    const { AdMob } = await import("@capacitor-community/admob");

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

export const showRewarded = async (): Promise<boolean> => {
  // على الويب: امنح المكافأة مباشرة
  if (!Capacitor.isNativePlatform()) return true;

  try {
    await initAdMob();

    const { AdMob, RewardAdPluginEvents } = await import("@capacitor-community/admob");

    let earned = false;

    const listener = await AdMob.addListener(
      RewardAdPluginEvents.Rewarded,
      () => {
        earned = true;
      }
    );

    try {
      await AdMob.prepareRewardVideoAd({ adId: REWARDED_AD_ID });
      await AdMob.showRewardVideoAd();
    } catch (innerErr) {
      console.warn("[AdMob] rewarded prepare/show failed, granting reward anyway", innerErr);
      listener.remove();
      // الإعلان فشل (No fill / الحساب لسه قيد المراجعة) — امنح الأداة عشان المستخدم ميتعطلش
      return true;
    }

    listener.remove();

    // لو شغّال لكن المستخدم قفله قبل ما يخلص — امنحه برضه (تجربة أحسن)
    return earned || true;
  } catch (e) {
    console.warn("[AdMob] rewarded failed", e);
    // Fallback: امنح المكافأة عشان الأزرار تشتغل دايماً
    return true;
  }
};
