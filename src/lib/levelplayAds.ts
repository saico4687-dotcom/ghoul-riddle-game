import { registerPlugin, Capacitor } from "@capacitor/core";
import type { PluginListenerHandle } from "@capacitor/core";

export type LevelPlayFormat = "interstitial" | "rewarded" | "banner";
export type LevelPlayEventType =
    | "loaded"
    | "failedToLoad"
    | "displayed"
    | "displayFailed"
    | "closed"
    | "clicked"
    | "rewarded";

export interface LevelPlayEvent {
    format: LevelPlayFormat;
    tag: string;
    type: LevelPlayEventType;
    revenue?: number;
    error?: string;
}

export interface LevelPlayAdsPlugin {
    initialize(options: { appKey: string }): Promise<void>;
    loadInterstitial(options: { adUnitId: string; tag: string }): Promise<void>;
    isInterstitialReady(options: { tag: string }): Promise<{ ready: boolean }>;
    showInterstitial(options: { tag: string }): Promise<void>;
    loadRewarded(options: { adUnitId: string; tag: string }): Promise<void>;
    isRewardedReady(options: { tag: string }): Promise<{ ready: boolean }>;
    showRewarded(options: { tag: string }): Promise<void>;
    showBanner(options: { adUnitId: string; marginBottom?: number }): Promise<void>;
    hideBanner(): Promise<void>;
    addListener(
        eventName: "levelPlayEvent",
        listenerFunc: (event: LevelPlayEvent) => void
    ): Promise<PluginListenerHandle>;
}

export const LevelPlayAds = registerPlugin<LevelPlayAdsPlugin>("LevelPlayAds");

export const isNative = () => Capacitor.isNativePlatform();
