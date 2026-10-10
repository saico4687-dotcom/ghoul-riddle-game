// إشعارات الموبايل الحقيقية (FCM) — بتشتغل على أندرويد/iOS فقط، وعلى الويب لا تفعل شيئًا.
import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";

export const PUSH_OPENED_EVENT = "rabh:push-opened";
let wired = false;

export async function registerNativePush(userId: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");
    if (!wired) {
      wired = true;
      await PushNotifications.addListener("registration", async (t) => {
        await supabase.from("fcm_tokens").upsert(
          { token: t.value, user_id: userId, platform: Capacitor.getPlatform(), updated_at: new Date().toISOString() },
          { onConflict: "token" },
        );
      });
      await PushNotifications.addListener("pushNotificationActionPerformed", () => {
        window.dispatchEvent(new Event(PUSH_OPENED_EVENT));
      });
      await PushNotifications.createChannel({
        id: "challenges",
        name: "التحديات",
        description: "إشعارات التحدي",
        importance: 5,
        visibility: 1,
        vibration: true,
      }).catch(() => {});
    }
    let perm = await PushNotifications.checkPermissions();
    if (perm.receive === "prompt") perm = await PushNotifications.requestPermissions();
    if (perm.receive !== "granted") return;
    await PushNotifications.register();
  } catch {
    // مش بنكسر التطبيق لو الإشعارات فشلت
  }
}
