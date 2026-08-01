// Edge Function: send-push
// بيستقبل قائمة user_id + عنوان/نص الإشعار، ويجيب كل الأجهزة المسجّلة
// لكل مستخدم من device_tokens (platform='web' فيها JSON.stringify
// بتاع الـ PushSubscription)، ويبعت لكل جهاز Push حقيقي عبر VAPID.
// بيوصل حتى لو التطبيق مقفول تمامًا لإن المتصفح نفسه هو اللي بيستقبله
// عبر Service Worker (public/push-sw.js).
//
// المتغيرات المطلوبة (تتحط في Supabase → Edge Functions → Secrets):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:you@example.com)
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (موجودين تلقائيًا في بيئة كل Edge Function)

import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

webpush.setVapidDetails(
  Deno.env.get("VAPID_SUBJECT") ?? "mailto:support@example.com",
  Deno.env.get("VAPID_PUBLIC_KEY")!,
  Deno.env.get("VAPID_PRIVATE_KEY")!
);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // نتأكد إن التوكن المبعوت فعلاً بتاع مستخدم مسجل دخول حقيقي — مانبعتش
    // Push نيابة عن حد من غير جلسة صحيحة.
    const { data: authUser, error: authErr } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authErr || !authUser?.user) {
      return json({ error: "Unauthorized" }, 401);
    }

    const body = await req.json();
    const recipientUserIds: string[] = Array.isArray(body?.recipientUserIds)
      ? body.recipientUserIds
      : [];
    const title: string = body?.title ?? "رسالة جديدة";
    const message: string = body?.body ?? "";
    const url: string = body?.url ?? "/chat";
    // "call" لمكالمة واردة (يُعرض بشكل مُلح في الـ Service Worker) —
    // أي قيمة تانية أو مفيش قيمة أصلاً تتعامل كإشعار عادي (رسالة/منشن/إلخ)
    const type: string | undefined = body?.type;

    // منقدرش نبعت لنفس الشخص اللي بعت — مفيش داعي يوصله إشعار برسالته هو
    const targets = recipientUserIds.filter((id) => id !== authUser.user.id);
    if (targets.length === 0) return json({ sent: 0 });

    const { data: tokens } = await supabase
      .from("device_tokens")
      .select("id, user_id, token")
      .in("user_id", targets)
      .eq("platform", "web");

    let sent = 0;
    const staleIds: string[] = [];

    for (const row of tokens ?? []) {
      try {
        const subscription = JSON.parse(row.token);
        await webpush.sendNotification(
          subscription,
          JSON.stringify({ title, body: message, url, type }),
          type === "call" ? { TTL: 45, urgency: "high" } : undefined
        );
        sent++;
      } catch (err: any) {
        // 404/410 يعني الاشتراك بايظ (المستخدم مسح المتصفح أو غيّر الجهاز) — نمسحه
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          staleIds.push(row.id);
        }
      }
    }

    if (staleIds.length > 0) {
      await supabase.from("device_tokens").delete().in("id", staleIds);
    }

    return json({ sent });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
