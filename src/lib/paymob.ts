import { Browser } from "@capacitor/browser";
import { App as CapacitorApp } from "@capacitor/app";
import { supabase } from "@/integrations/supabase/client";
import { isNativePlatform as isNative } from "@/lib/isNative";

export type PurchaseProduct = "reward_unlock" | "no_ads";

/**
 * يبدأ عملية دفع بايموب (Paymob) لمنتج معيّن:
 *  1) يطلب رابط الدفع من Edge Function (create-paymob-payment) — الرابط
 *     بيتحسب بالكامل على السيرفر عشان مفتاح بايموب السري ميبانش أبدًا
 *     في كود الموبايل.
 *  2) يفتحه في متصفح داخل التطبيق (Capacitor Browser) بدل ما يودّي
 *     المستخدم برّه التطبيق تمامًا.
 *  3) لما بايموب يرجّع المستخدم لرابط com.rebh.app://payment-result
 *     بعد الدفع، بنقفل المتصفح الداخلي تلقائيًا ونرجع للتطبيق —
 *     الفتح الفعلي للميزة بيحصل من السيرفر (بايموب-ويبهوك) مش من هنا،
 *     فبنكتفي هنا بعمل refresh لحالة المشتريات.
 */
export async function startPaymobCheckout(
  product: PurchaseProduct,
  onReturn?: () => void
): Promise<void> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) {
    alert("سجّل الدخول أولاً لإتمام الشراء.");
    return;
  }

  const { data, error } = await supabase.functions.invoke("create-paymob-payment", {
    body: { product },
  });

  if (error || !data?.paymentUrl) {
    console.error("[Paymob] create-paymob-payment failed", error, data);
    alert("تعذر بدء عملية الدفع حاليًا، حاول مرة أخرى بعد قليل.");
    return;
  }

  if (!isNative()) {
    // معاينة الويب: نفتح في تبويب جديد لأن سكيم الرجوع المخصص شغال
    // على الموبايل فقط.
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
    // المستخدم قفل المتصفح يدويًا برضه بيرجّعه للتطبيق طبيعي —
    // بنعمل refresh للحالة في الحالتين.
    onReturn?.();
    urlListener.remove();
  });

  await Browser.open({ url: data.paymentUrl, presentationStyle: "popover" });

  // ننضف الـ listeners بعد دقيقتين لو المستخدم مسكرش المتصفح خالص،
  // عشان ميفضلوش متراكمين لو كرر عملية الشراء أكتر من مرة.
  setTimeout(() => {
    urlListener.remove();
    closedListener.remove();
  }, 120_000);
}
