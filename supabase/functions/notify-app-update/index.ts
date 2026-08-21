// Edge Function: notify-app-update
//
// بتتنادى مرة واحدة بس، آخر خطوة في workflow بناء الأندرويد
// (.github/workflows/android-build.yml) بعد ما الـ AAB يتبني ويتوقّع
// بنجاح، وبتبعت Push حقيقي "فيه تحديث جديد" لكل مستخدم عنده جهاز
// مسجّل — مش لمستخدمين محددين زي send-push، دي بتوصل لكل الناس.
//
// مختلفة عن send-push في نقطتين مهمين:
//   1) بتتنادى من GitHub Actions (سيرفر لسيرفر) مش من التطبيق نفسه،
//      فمفيش Authorization Bearer بتاع مستخدم مسجّل دخول. بدل كده
//      بنتحقق من هيدر x-deploy-secret مطابق لـ APP_UPDATE_NOTIFY_SECRET.
//   2) بتبعت لكل الأجهزة المسجّلة في device_tokens (platform='web')
//      من غير أي فلترة بـ user_id، لإن التحديث يهم كل مستخدم.
//
// المتغيرات المطلوبة (Supabase → Edge Functions → Secrets):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT   (نفس المستخدمين
//                                                          في send-push)
//   APP_UPDATE_NOTIFY_SECRET   قيمة سرّية من اختيارك، لازم تتساوى مع
//                              secrets.APP_UPDATE_NOTIFY_SECRET في
//                              GitHub Actions (Settings → Secrets)
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  (موجودين تلقائيًا)

import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-deploy-secret",
};

webpush.setVapidDetails(
  Deno.env.get("VAPID_SUBJECT") ?? "mailto:support@example.com",
  Deno.env.get("VAPID_PUBLIC_KEY")!,
  Deno.env.get("VAPID_PRIVATE_KEY")!
);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

    const deploySecret = Deno.env.get("APP_UPDATE_NOTIFY_SECRET");
    if (!deploySecret) {
      console.error("APP_UPDATE_NOTIFY_SECRET not configured");
      return json({ error: "Not configured" }, 503);
    }

    // مقارنة constant-time بدل ===  عشان نمنع timing attack بسيط على
    // السر، زي ما بنعمل بالظبط في paymob-webhook مع الـ HMAC.
    const receivedSecret = req.headers.get("x-deploy-secret") ?? "";
    if (!timingSafeEqual(receivedSecret, deploySecret)) {
      console.error("notify-app-update: invalid deploy secret");
      return json({ error: "Unauthorized" }, 401);
    }

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      body = {};
    }
    const version = typeof body?.version === "string" && body.version.trim() ? body.version.trim() : null;

    const title = "🔔 تحديث جديد متاح!";
    const message = version
      ? `النسخة ${version} من رعب الألغاز نزلت — حدّث التطبيق دلوقتي عشان تلعب بآخر إضافة.`
      : "نسخة جديدة من رعب الألغاز نزلت — حدّث التطبيق دلوقتي.";

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // بنجيب كل أجهزة الويب المسجّلة (بدون فلترة user_id — التحديث
    // يهم كل مستخدم عنده اشتراك Push فعّال). بنقسّمها صفحات (1000
    // في كل مرة) عشان لو عدد المستخدمين كبير مستقبلًا.
    const PAGE_SIZE = 1000;
    let from = 0;
    let sent = 0;
    let failed = 0;
    const staleIds: string[] = [];

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { data: tokens, error } = await supabase
        .from("device_tokens")
        .select("id, token")
        .eq("platform", "web")
        .range(from, from + PAGE_SIZE - 1);

      if (error) {
        console.error("notify-app-update: device_tokens fetch failed", error);
        break;
      }
      if (!tokens || tokens.length === 0) break;

      for (const row of tokens) {
        try {
          const subscription = JSON.parse(row.token);
          await webpush.sendNotification(
            subscription,
            JSON.stringify({ title, body: message, url: "/", type: "app_update" })
          );
          sent++;
        } catch (err: any) {
          failed++;
          // 404/410 يعني الاشتراك بايظ (مسح المتصفح/غيّر الجهاز) — نمسحه.
          if (err?.statusCode === 404 || err?.statusCode === 410) {
            staleIds.push(row.id);
          } else {
            console.error("notify-app-update: send failed", row.id, err?.statusCode, err?.message);
          }
        }
      }

      if (tokens.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }

    if (staleIds.length > 0) {
      await supabase.from("device_tokens").delete().in("id", staleIds);
    }

    console.log(`notify-app-update: sent=${sent} failed=${failed} stale_removed=${staleIds.length}`);
    return json({ sent, failed });
  } catch (e) {
    console.error("notify-app-update error", e);
    return json({ error: "Internal error" }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length || a.length === 0) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}
