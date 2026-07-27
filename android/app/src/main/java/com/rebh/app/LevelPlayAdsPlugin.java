package com.rebh.app;

import android.view.Gravity;
import android.widget.FrameLayout;
import android.view.ViewGroup;

import androidx.annotation.NonNull;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import com.unity3d.mediation.LevelPlay;
import com.unity3d.mediation.LevelPlayAdError;
import com.unity3d.mediation.LevelPlayAdInfo;
import com.unity3d.mediation.LevelPlayAdSize;
import com.unity3d.mediation.LevelPlayBannerAdView;
import com.unity3d.mediation.LevelPlayBannerAdViewListener;
import com.unity3d.mediation.LevelPlayConfiguration;
import com.unity3d.mediation.LevelPlayInitError;
import com.unity3d.mediation.LevelPlayInitListener;
import com.unity3d.mediation.LevelPlayInitRequest;
import com.unity3d.mediation.LevelPlayInterstitialAd;
import com.unity3d.mediation.LevelPlayInterstitialAdListener;
import com.unity3d.mediation.LevelPlayReward;
import com.unity3d.mediation.LevelPlayRewardedAd;
import com.unity3d.mediation.LevelPlayRewardedAdListener;

import java.util.HashMap;
import java.util.Map;

/**
 * بلجن Capacitor مخصوص (كتبناه إحنا، مش من مكتبة جاهزة) بيوصل تطبيق
 * الويب بـ Unity LevelPlay (ironSource) SDK جنبًا إلى جنب مع AdMob
 * اللي شغال بالفعل في src/lib/ads.ts من غير ما نلمسه.
 *
 * كل الأحداث (تحميل / فشل / عرض / إغلاق / مكافأة) بترجع لجافاسكريبت
 * عن طريق حدث واحد اسمه "levelPlayEvent" عشان يبقى بسيط، وJS هو اللي
 * بيقرر يعمل بيه إيه.
 */
@CapacitorPlugin(name = "LevelPlayAds")
public class LevelPlayAdsPlugin extends Plugin {

    private final Map<String, LevelPlayInterstitialAd> interstitials = new HashMap<>();
    private final Map<String, LevelPlayRewardedAd> rewardeds = new HashMap<>();
    private LevelPlayBannerAdView bannerView;

    private boolean initialized = false;
    private PluginCall pendingInitCall;

    /* ---------------------------------------------------------- */

    @PluginMethod
    public void initialize(PluginCall call) {
        if (initialized) {
            call.resolve();
            return;
        }

        String appKey = call.getString("appKey");
        if (appKey == null || appKey.isEmpty()) {
            call.reject("appKey is required");
            return;
        }

        pendingInitCall = call;

        LevelPlayInitRequest initRequest = new LevelPlayInitRequest.Builder(appKey).build();

        LevelPlay.init(getContext(), initRequest, new LevelPlayInitListener() {
            @Override
            public void onInitFailed(@NonNull LevelPlayInitError error) {
                initialized = false;
                if (pendingInitCall != null) {
                    pendingInitCall.reject("LevelPlay init failed: " + error.getErrorMessage());
                    pendingInitCall = null;
                }
            }

            @Override
            public void onInitSuccess(LevelPlayConfiguration configuration) {
                initialized = true;
                if (pendingInitCall != null) {
                    pendingInitCall.resolve();
                    pendingInitCall = null;
                }
            }
        });
    }

    /* ================= Interstitial ================= */

    @PluginMethod
    public void loadInterstitial(PluginCall call) {
        String adUnitId = call.getString("adUnitId");
        String tag = call.getString("tag", "default");

        LevelPlayInterstitialAd ad = interstitials.get(tag);
        if (ad == null) {
            ad = new LevelPlayInterstitialAd(adUnitId);
            ad.setListener(new LevelPlayInterstitialAdListener() {
                @Override
                public void onAdLoaded(@NonNull LevelPlayAdInfo adInfo) {
                    emit("interstitial", tag, "loaded", adInfo.getRevenue(), null);
                }

                @Override
                public void onAdLoadFailed(@NonNull LevelPlayAdError error) {
                    emit("interstitial", tag, "failedToLoad", null, error.getErrorMessage());
                }

                @Override
                public void onAdDisplayed(@NonNull LevelPlayAdInfo adInfo) {
                    emit("interstitial", tag, "displayed", null, null);
                }

                @Override
                public void onAdDisplayFailed(@NonNull LevelPlayAdError error, @NonNull LevelPlayAdInfo adInfo) {
                    emit("interstitial", tag, "displayFailed", null, error.getErrorMessage());
                }

                @Override
                public void onAdClicked(@NonNull LevelPlayAdInfo adInfo) {
                    emit("interstitial", tag, "clicked", null, null);
                }

                @Override
                public void onAdClosed(@NonNull LevelPlayAdInfo adInfo) {
                    emit("interstitial", tag, "closed", null, null);
                }

                @Override
                public void onAdInfoChanged(@NonNull LevelPlayAdInfo adInfo) {
                    // بيتنادى لما إعلان تاني يتحمّل بسعر أعلى — مش لازمين نعمل حاجة هنا
                }
            });
            interstitials.put(tag, ad);
        }

        ad.loadAd();
        call.resolve();
    }

    @PluginMethod
    public void isInterstitialReady(PluginCall call) {
        String tag = call.getString("tag", "default");
        LevelPlayInterstitialAd ad = interstitials.get(tag);
        JSObject ret = new JSObject();
        ret.put("ready", ad != null && ad.isAdReady());
        call.resolve(ret);
    }

    @PluginMethod
    public void showInterstitial(PluginCall call) {
        String tag = call.getString("tag", "default");
        LevelPlayInterstitialAd ad = interstitials.get(tag);
        if (ad == null || !ad.isAdReady()) {
            call.reject("Interstitial not ready: " + tag);
            return;
        }
        ad.showAd(getActivity());
        call.resolve();
    }

    /* ================= Rewarded ================= */

    @PluginMethod
    public void loadRewarded(PluginCall call) {
        String adUnitId = call.getString("adUnitId");
        String tag = call.getString("tag", "default");

        LevelPlayRewardedAd ad = rewardeds.get(tag);
        if (ad == null) {
            ad = new LevelPlayRewardedAd(adUnitId);
            ad.setListener(new LevelPlayRewardedAdListener() {
                @Override
                public void onAdLoaded(@NonNull LevelPlayAdInfo adInfo) {
                    emit("rewarded", tag, "loaded", adInfo.getRevenue(), null);
                }

                @Override
                public void onAdLoadFailed(@NonNull LevelPlayAdError error) {
                    emit("rewarded", tag, "failedToLoad", null, error.getErrorMessage());
                }

                @Override
                public void onAdDisplayed(@NonNull LevelPlayAdInfo adInfo) {
                    emit("rewarded", tag, "displayed", null, null);
                }

                @Override
                public void onAdDisplayFailed(@NonNull LevelPlayAdError error, @NonNull LevelPlayAdInfo adInfo) {
                    emit("rewarded", tag, "displayFailed", null, error.getErrorMessage());
                }

                @Override
                public void onAdClicked(@NonNull LevelPlayAdInfo adInfo) {
                    emit("rewarded", tag, "clicked", null, null);
                }

                @Override
                public void onAdClosed(@NonNull LevelPlayAdInfo adInfo) {
                    emit("rewarded", tag, "closed", null, null);
                }

                @Override
                public void onAdInfoChanged(@NonNull LevelPlayAdInfo adInfo) {
                }

                @Override
                public void onAdRewarded(@NonNull LevelPlayReward reward, @NonNull LevelPlayAdInfo adInfo) {
                    emit("rewarded", tag, "rewarded", null, null);
                }
            });
            rewardeds.put(tag, ad);
        }

        ad.loadAd();
        call.resolve();
    }

    @PluginMethod
    public void isRewardedReady(PluginCall call) {
        String tag = call.getString("tag", "default");
        LevelPlayRewardedAd ad = rewardeds.get(tag);
        JSObject ret = new JSObject();
        ret.put("ready", ad != null && ad.isAdReady());
        call.resolve(ret);
    }

    @PluginMethod
    public void showRewarded(PluginCall call) {
        String tag = call.getString("tag", "default");
        LevelPlayRewardedAd ad = rewardeds.get(tag);
        if (ad == null || !ad.isAdReady()) {
            call.reject("Rewarded not ready: " + tag);
            return;
        }
        ad.showAd(getActivity());
        call.resolve();
    }

    /* ================= Banner ================= */

    @PluginMethod
    public void showBanner(PluginCall call) {
        String adUnitId = call.getString("adUnitId");
        int marginBottomPx = call.getInt("marginBottom", 0);

        getActivity().runOnUiThread(() -> {
            if (bannerView != null) {
                ViewGroup parent = (ViewGroup) bannerView.getParent();
                if (parent != null) parent.removeView(bannerView);
            }

            LevelPlayBannerAdView.Config adConfig = new LevelPlayBannerAdView.Config.Builder()
                    .setAdSize(LevelPlayAdSize.BANNER)
                    .build();

            bannerView = new LevelPlayBannerAdView(getContext(), adUnitId, adConfig);
            bannerView.setBannerListener(new LevelPlayBannerAdViewListener() {
                @Override
                public void onAdLoaded(@NonNull LevelPlayAdInfo adInfo) {
                    emit("banner", "banner", "loaded", adInfo.getRevenue(), null);
                }

                @Override
                public void onAdLoadFailed(@NonNull LevelPlayAdError error) {
                    emit("banner", "banner", "failedToLoad", null, error.getErrorMessage());
                }

                @Override
                public void onAdDisplayed(@NonNull LevelPlayAdInfo adInfo) {
                }

                @Override
                public void onAdDisplayFailed(@NonNull LevelPlayAdError error, @NonNull LevelPlayAdInfo adInfo) {
                }

                @Override
                public void onAdClicked(@NonNull LevelPlayAdInfo adInfo) {
                }

                @Override
                public void onAdExpanded(@NonNull LevelPlayAdInfo adInfo) {
                }

                @Override
                public void onAdCollapsed(@NonNull LevelPlayAdInfo adInfo) {
                }

                @Override
                public void onAdLeftApplication(@NonNull LevelPlayAdInfo adInfo) {
                }
            });

            FrameLayout.LayoutParams params = new FrameLayout.LayoutParams(
                    ViewGroup.LayoutParams.WRAP_CONTENT,
                    ViewGroup.LayoutParams.WRAP_CONTENT
            );
            params.gravity = Gravity.BOTTOM | Gravity.CENTER_HORIZONTAL;
            params.bottomMargin = marginBottomPx;

            ViewGroup root = getActivity().findViewById(android.R.id.content);
            root.addView(bannerView, params);

            bannerView.loadAd();
        });

        call.resolve();
    }

    @PluginMethod
    public void hideBanner(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            if (bannerView != null) {
                ViewGroup parent = (ViewGroup) bannerView.getParent();
                if (parent != null) parent.removeView(bannerView);
                bannerView.destroy();
                bannerView = null;
            }
        });
        call.resolve();
    }

    /* ---------------------------------------------------------- */

    private void emit(String format, String tag, String type, Double revenue, String error) {
        JSObject data = new JSObject();
        data.put("format", format);
        data.put("tag", tag);
        data.put("type", type);
        if (revenue != null) data.put("revenue", revenue);
        if (error != null) data.put("error", error);
        notifyListeners("levelPlayEvent", data);
    }
                         }
