import { Capacitor } from "@capacitor/core";

/** True when running inside the native Capacitor shell (Android / iOS). */
export const isNativePlatform = (): boolean => {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
};
