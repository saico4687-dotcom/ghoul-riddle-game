import { useEffect } from "react";
import { useAdFree } from "@/hooks/useAdFree";
import { showBannerAd, hideBannerAd } from "@/lib/adsMediation";

// ارتفاع شريط التنقل السفلي بالبكسل — لازم يتطابق مع الرقم المستخدم
// في ChatLayout.tsx
export const BOTTOM_NAV_HEIGHT = 64;
// المساحة الفاضية المحجوزة لبانر AdMob التكيفي فوق شريط التنقل مباشرة
export const BANNER_SLOT_HEIGHT = 56;

// بيعرض البانر برفع (margin) يساوي ارتفاع شريط التنقل، عشان البانر
// يظهر فوقه مش فوق أزراره، وبيحجز نفس المساحة في التخطيط العادي
// عشان محتوى الدردشة مايتخبيش وراه. بيختفي تلقائياً وقت "دردشة بدون
// إعلانات".
export default function ChatBannerSlot() {
  const { isAdFree } = useAdFree();

  useEffect(() => {
    if (isAdFree) {
      void hideBannerAd();
      return;
    }
    void showBannerAd({ marginBottom: BOTTOM_NAV_HEIGHT });
    return () => {
      void hideBannerAd();
    };
  }, [isAdFree]);

  if (isAdFree) return null;

  return <div style={{ height: BANNER_SLOT_HEIGHT }} aria-hidden="true" className="w-full shrink-0" />;
}
