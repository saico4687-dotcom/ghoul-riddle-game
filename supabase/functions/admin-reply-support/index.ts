import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

/**
 * بيسمح فقط لمستخدم عنده role='admin' (has_role) إنه يكتب رسالة
 * بصفة 'admin' في محادثة مستخدم معيّن. الكتابة بتتم بصلاحية service
 * role عشان RLS الأساسية على support_messages بتمنع أي حد يكتب
 * sender='admin' مباشرة من الكلاينت.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: claims, error: claimsErr } = await userClient.auth.getClaims(
      authHeader.replace("Bearer ", ""),
    );
    if (claimsErr || !claims?.claims?.sub) return json({ error: "Unauthorized" }, 401);
    const adminId = claims.claims.sub as string;

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: adminId, _role: "admin" });
    if (!isAdmin) return json({ error: "Forbidden" }, 403);

    let body: unknown;
    try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
    const b = body as Record<string, unknown>;
    const targetUserId = String(b.user_id ?? "");
    const messageBody = String(b.body ?? "").trim();
    if (!targetUserId || !messageBody) return json({ error: "Missing fields" }, 400);

    const { error: insertErr } = await admin.from("support_messages").insert({
      user_id: targetUserId,
      sender: "admin",
      body: messageBody,
      read_by_admin: true,
    });
    if (insertErr) return json({ error: "Could not send reply" }, 500);

    // إشعار Push للمستخدم إن فيه رد جديد من خدمة العملاء
    try {
      const { data: tokens } = await admin
        .from("device_tokens")
        .select("id, token")
        .eq("user_id", targetUserId)
        .eq("platform", "web");
      if (tokens && tokens.length > 0) {
        const webpush = await import("npm:web-push@3.6.7");
        webpush.default.setVapidDetails(
          Deno.env.get("VAPID_SUBJECT") ?? "mailto:support@example.com",
          Deno.env.get("VAPID_PUBLIC_KEY")!,
          Deno.env.get("VAPID_PRIVATE_KEY")!,
        );
        for (const row of tokens) {
          try {
            await webpush.default.sendNotification(
              JSON.parse(row.token as string),
              JSON.stringify({ title: "رد جديد من خدمة العملاء", body: messageBody, url: "/support" }),
            );
          } catch { /* أفضل مجهود، لا نوقف الطلب لو فشل إشعار جهاز واحد */ }
        }
      }
    } catch (e) {
      console.error("admin-reply-support: push failed", e);
    }

    return json({ ok: true });
  } catch (e) {
    console.error("admin-reply-support error", e);
    return json({ error: "Internal error" }, 500);
  }
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
