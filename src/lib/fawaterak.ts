import { Browser } from "@capacitor/browser";
import { App as CapacitorApp } from "@capacitor/app";
import { supabase } from "@/integrations/supabase/client";
import { isNativePlatform as isNative } from "@/lib/isNative";
import type { PurchaseProduct } from "@/lib/paymob";

/**
 * نفس فكرة startPaymobCheckout بالظبط، بس بتنادي
 * create-fawaterak-payment بدل create-paymob-payment. مخصصة أساسًا
 * لخيار "ادفع بالمحفظة الإلكترونية" لحد ما بايموب يفعّل الـ Mobile
 * Wallet integration بتاعه.
 */
export async function startFawaterakCheckout(
  product: PurchaseProduct,
  onReturn?: () => void
): Promise<void> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) {
    alert("سجّل الدخول أولاً لإتمام الشراء.");
    return;
  }

  const { data, error } = await supabase.functions.invoke("create-fawaterak-payment", {
    body: { product },
  });

  if (error || !data?.paymentUrl) {
    console.error("[Fawaterak] create-fawaterak-payment failed", error, data);
    alert("تعذر بدء عملية الدفع حاليًا، حاول مرة أخرى بعد قليل.");
    return;
  }

  if (!isNative()) {
    window.open(data.paymentUrl, "_blank", "noopener,noreferrer");
    return;
  }

  let returned = false;
  const closeAndReturn = () => {
    if (returned) return;
    returned = true;
    void Browser.close().catch(() => {});
    onReturn?.();
  };

  const urlListener = await CapacitorApp.addListener("appUrlOpen", (event) => {
    if (event.url?.startsWith("com.rebh.app://payment-result")) {
      closeAndReturn();
    }
  });

  const closedListener = await Browser.addListener("browserFinished", () => {
    onReturn?.();
    urlListener.remove();
  });

  await Browser.open({ url: data.paymentUrl, presentationStyle: "popover" });

  setTimeout(() => {
    urlListener.remove();
    closedListener.remove();
  }, 120_000);
}
