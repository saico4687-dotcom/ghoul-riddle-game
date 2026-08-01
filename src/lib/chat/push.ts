// تسجيل/إلغاء Push Notifications الحقيقية على مستوى الجهاز (نظام
// التشغيل)، وإرسالها فعليًا بعد كل رسالة عبر Edge Function (send-push).
//
// المفتاح العام هنا (VAPID_PUBLIC_KEY) آمن إنه يتحط في كود العميل —
// هو "عام" بطبيعته زي أي مفتاح تشفير عام. المفتاح الخاص المقابل له
// موجود بس في Secrets بتاع الـ Edge Function ومحدش يقدر يوصله من هنا.
import { supabase } from "@/integrations/supabase/client";

// ⚠️ استبدلها بمفتاحك العام الحقيقي بعد ما تحط المفتاح الخاص في
// Supabase → Edge Functions → Secrets (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY)
const VAPID_PUBLIC_KEY =
  "BCdeKE0Oqy0OYhhPYC3gee2--6hYL9mj3B0o_a4meekHtJtwx_N6BDKbRL67lqX11xFX_GgbNA21BhG4Mu9utXs";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export function isPushSupported() {
  return "serviceWorker" in navigator && "PushManager" in window;
}

export async function getPushPermissionState(): Promise<NotificationPermission | "unsupported"> {
  if (!isPushSupported()) return "unsupported";
  return Notification.permission;
}

/** يطلب إذن الإشعارات ويسجّل الاشتراك في device_tokens */
export async function enableDevicePush(userId: string): Promise<boolean> {
  if (!isPushSupported()) return false;

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return false;

  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }

  const { error } = await supabase.from("device_tokens").upsert(
    {
      user_id: userId,
      token: JSON.stringify(subscription),
      platform: "web",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "token" }
  );

  return !error;
}

/** يلغي الاشتراك على الجهاز الحالي ويمسحه من device_tokens */
export async function disableDevicePush(): Promise<void> {
  if (!isPushSupported()) return;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;

  await supabase.from("device_tokens").delete().eq("token", JSON.stringify(subscription));
  await subscription.unsubscribe();
}

/** بيتنادى بعد إرسال رسالة (فردية أو جروب) عشان يوصل Push حقيقي للمستلمين */
export async function sendMessagePush(
  recipientUserIds: string[],
  title: string,
  body: string,
  url = "/chat"
) {
  if (recipientUserIds.length === 0) return;
  try {
    await supabase.functions.invoke("send-push", {
      body: { recipientUserIds, title, body, url },
    });
  } catch {
    // فشل إرسال الـ Push مش المفروض يوقف إرسال الرسالة نفسها — نتجاهله بصمت
  }
}
