import { Capacitor } from "@capacitor/core";

// AdMob IDs
export const ADMOB_APP_ID = "ca-app-pub-4098736191122679~4275235624";
// Test interstitial ID — replace with your real one in production
export const INTERSTITIAL_AD_ID = "ca-app-pub-3940256099942544/1033173712";

let initialized = false;
let lastShown = 0;

export const initAdMob = async () => {
  if (initialized) return;
  if (!Capacitor.isNativePlatform()) {
    initialized = true;
    return;
  }
  try {
    const { AdMob } = await import("@capacitor-community/admob");
    await AdMob.initialize({
      initializeForTesting: false,
    });
    initialized = true;
  } catch (e) {
    console.warn("[AdMob] init failed", e);
  }
};

export const showInterstitial = async () => {
  if (!Capacitor.isNativePlatform()) return;
  // Throttle — don't show more than once every 25s
  const now = Date.now();
  if (now - lastShown < 25_000) return;
  try {
    const { AdMob, AdmobConsentStatus } = await import("@capacitor-community/admob");
    await initAdMob();
    await AdMob.prepareInterstitial({ adId: INTERSTITIAL_AD_ID });
    await AdMob.showInterstitial();
    lastShown = Date.now();
  } catch (e) {
    console.warn("[AdMob] interstitial failed", e);
  }
};
