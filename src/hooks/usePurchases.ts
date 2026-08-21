import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export interface PurchaseState {
  purchasedRewardUnlock: boolean;
  purchasedNoInterstitial: boolean;
  purchasedNoAds: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
}

// حالة المشتريات مربوطة بحساب المستخدم على السيرفر (profiles) —
// مش بأي تخزين محلي على الجهاز، فلو دخل بحساب تاني (أو مسح بيانات
// التطبيق) هترجع false لحد ما يشتري هو بنفسه بنفس الحساب ده.
export function usePurchases(): PurchaseState {
  const { user } = useAuth();
  const [purchasedRewardUnlock, setPurchasedRewardUnlock] = useState(false);
  const [purchasedNoInterstitial, setPurchasedNoInterstitial] = useState(false);
  const [purchasedNoAds, setPurchasedNoAds] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setPurchasedRewardUnlock(false);
      setPurchasedNoInterstitial(false);
      setPurchasedNoAds(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("profiles")
      .select("purchased_reward_unlock, purchased_no_interstitial, purchased_no_ads")
      .eq("user_id", user.id)
      .maybeSingle();

    setPurchasedRewardUnlock(Boolean((data as any)?.purchased_reward_unlock));
    setPurchasedNoInterstitial(Boolean((data as any)?.purchased_no_interstitial));
    setPurchasedNoAds(Boolean((data as any)?.purchased_no_ads));
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { purchasedRewardUnlock, purchasedNoInterstitial, purchasedNoAds, loading, refresh };
}
