import { Purchases, PRODUCT_CATEGORY } from "@revenuecat/purchases-capacitor";
import { isNativePlatform as isNative } from "@/lib/isNative";

export type PurchaseProduct = "reward_unlock" | "no_interstitial" | "no_ads";

/**
 * ⚠️ لازم تتطابق حرفيًا مع الـ Product ID اللي عملته في Play Console
 * (تحقيق الربح مع Google Play → المنتجات → منتجات يتم تحصيل سعرها
 * مرة واحدة). لو سميتهم بأسماء تانية هناك، عدّل القيم هنا بدل
 * المفاتيح.
 */
const PRODUCT_IDS: Record<PurchaseProduct, string> = {
  reward_unlock: "reward_unlock",
  no_interstitial: "no_interstitial",
  no_ads: "no_ads",
};

// من RevenueCat Dashboard → Project settings → API keys → Google
// Play. مفتاح عام (Public SDK key) آمن يتحط في كود الموبايل، مختلف
// تمامًا عن أي مفتاح سري في لوحة جوجل بلاي نفسها.
const REVENUECAT_ANDROID_API_KEY = import.meta.env.VITE_REVENUECAT_ANDROID_API_KEY as
  | string
  | undefined;

let configuredForUserId: string | null = null;

/**
 * لازم تتنادى بـ userId بتاع Supabase قبل أي محاولة شراء — عشان
 * RevenueCat يربط عملية الشراء بنفس حساب المستخدم عندنا (مش بمعرّف
 * anonymous مؤقت مش هنقدر نلاقيه تاني في الويبهوك).
 */
export async function initBilling(userId: string | null): Promise<void> {
  if (!isNative()) return; // Google Play Billing شغال بس جوه التطبيق الحقيقي، مش الويب
  if (!userId || configuredForUserId === userId) return;

  if (!REVENUECAT_ANDROID_API_KEY) {
    console.error("[Billing] VITE_REVENUECAT_ANDROID_API_KEY missing — راجع .env");
    return;
  }

  try {
    if (!configuredForUserId) {
      await Purchases.configure({ apiKey: REVENUECAT_ANDROID_API_KEY, appUserID: userId });
    } else {
      await Purchases.logIn({ appUserID: userId });
    }
    configuredForUserId = userId;
  } catch (e) {
    console.error("[Billing] configure/logIn failed", e);
  }
}

/**
 * يبدأ عملية شراء منتج (دفعة واحدة، مش اشتراك) عن طريق Google Play
 * Billing مباشرة — مفيش أي بوابة دفع خارجية هنا خالص. فتح الميزة
 * الفعلي بيحصل من السيرفر (revenuecat-webhook) بعد ما جوجل تأكد
 * الدفع، فبعد نجاح الشراء هنا بنكتفي بعمل refresh لحالة المشتريات
 * بعد شوية ثواني.
 */
export async function purchaseProduct(
  product: PurchaseProduct,
  userId: string | null,
  onSuccess?: () => void,
): Promise<void> {
  if (!isNative()) {
    alert("الشراء متاح فقط من داخل تطبيق الموبايل من المتجر.");
    return;
  }
  if (!userId) {
    alert("سجّل الدخول أولاً لإتمام الشراء.");
    return;
  }

  await initBilling(userId);

  try {
    const { products } = await Purchases.getProducts({
      productIdentifiers: [PRODUCT_IDS[product]],
      type: PRODUCT_CATEGORY.NON_SUBSCRIPTION,
    });

    const storeProduct = products?.[0];
    if (!storeProduct) {
      alert("المنتج غير متاح حاليًا على المتجر، حاول مرة أخرى بعد قليل.");
      return;
    }

    await Purchases.purchaseStoreProduct({ product: storeProduct });

    // فتح الميزة الحقيقي جاي من السيرفر (ويبهوك RevenueCat)، ده بس
    // تحديث للواجهة بعد شوية عشان يبان للمستخدم على طول.
    setTimeout(() => onSuccess?.(), 3000);
  } catch (e: any) {
    if (e?.userCancelled) return; // المستخدم لغى بنفسه، مفيش داعي لرسالة خطأ
    console.error("[Billing] purchase failed", e);
    alert("تعذر إتمام عملية الشراء، حاول مرة أخرى.");
  }
}
