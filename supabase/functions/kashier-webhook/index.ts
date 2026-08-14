import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * Endpoint عام (بيتنادى من سيرفرات كاشير مباشرة، مش من التطبيق) —
 * بيستقبل إشعار نجاح/فشل الدفع، يتحقق من توقيع كاشير، ثم يفتح
 * الميزة فعليًا على حساب صاحب الطلب:
 *
 *   - reward_unlock ناجح → profiles.purchased_reward_unlock = true
 *   - no_ads ناجح        → profiles.purchased_no_ads = true
 *                           (وبيشمل أيضًا purchased_reward_unlock،
 *                           لأن باقة الـ 50 جنيه أشمل من باقة الـ 30)
 *
 * التحقق من التوقيع هنا مطابق حرفيًا لتوثيق كاشير الرسمي
 * (developers.kashier.io/payment/webhook):
 *   1) ياخد data.signatureKeys اللي كاشير نفسه بيبعتها في الـ payload
 *      ويرتبها أبجديًا.
 *   2) يبني query-string من قيم المفاتيح دي بس (بالترتيب ده).
 *   3) HMAC-SHA256 للـ query-string ده بمفتاح Payment API Key
 *      (نفس المفتاح اللي بيتحسب بيه هاش رابط الدفع — مفيش سر
 *      "ويبهوك" منفصل عند كاشير).
 *   4) يقارن الناتج بـ header اسمه x-kashier-signature.
 *
 * ⚠️ لازم تضبط KASHIER_API_KEY في أسرار الـ Edge Functions (نفسه
 * المستخدم في create-kashier-payment)، وتحط رابط الفنكشن ده
 * (…/functions/v1/kashier-webhook) في لوحة كاشير كـ Webhook URL.
 */

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

    const raw = await req.text();
    const signature = req.headers.get("x-kashier-signature") || "";
    const apiKey = Deno.env.get("KASHIER_API_KEY");

    if (!apiKey) {
      console.error("KASHIER_API_KEY not configured");
      return new Response("Not configured", { status: 503 });
    }

    let body: { event?: string; data?: Record<string, unknown> };
    try {
      body = JSON.parse(raw);
    } catch {
      return new Response("Invalid JSON", { status: 400 });
    }

    const data = body.data;
    const signatureKeys = Array.isArray(data?.signatureKeys) ? [...(data!.signatureKeys as string[])] : null;
    if (!data || !signatureKeys) {
      return new Response("Missing signatureKeys", { status: 400 });
    }

    signatureKeys.sort();
    const pairs = signatureKeys.map(
      (k) => `${encodeURIComponent(k)}=${encodeURIComponent(String(data[k] ?? ""))}`
    );
    const signaturePayload = pairs.join("&");
    const expected = await hmacSha256Hex(apiKey, signaturePayload);

    if (!signature || !timingSafeEqual(signature, expected)) {
      console.error("kashier-webhook: invalid signature");
      return new Response("Invalid signature", { status: 401 });
    }

    const orderId = String(data.merchantOrderId ?? "");
    const status = String(data.status ?? "").toUpperCase();
    const reference = data.transactionId ? String(data.transactionId) : null;

    if (!orderId) return new Response("Missing merchantOrderId", { status: 400 });

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: purchase, error: findErr } = await admin
      .from("purchases")
      .select("order_id, user_id, product, status")
      .eq("order_id", orderId)
      .maybeSingle();

    if (findErr || !purchase) {
      console.error("kashier-webhook: unknown order", orderId, findErr);
      // نرجع 200 برضه عشان كاشير ميعيدش يبعت الإشعار كل شوية لطلب
      // مش موجود عندنا أصلاً (مش خطأ عندهم).
      return new Response("Unknown order", { status: 200 });
    }

    // Idempotency: لو الطلب اتعالج قبل كده كـ success متعملش حاجة تاني.
    if (purchase.status === "success") {
      return new Response("OK", { status: 200 });
    }

    const success = status === "SUCCESS";
    await admin
      .from("purchases")
      .update({
        status: success ? "success" : "failed",
        kashier_reference: reference,
        updated_at: new Date().toISOString(),
      })
      .eq("order_id", orderId);

    if (success) {
      const patch: Record<string, boolean> =
        purchase.product === "no_ads"
          ? { purchased_no_ads: true, purchased_reward_unlock: true }
          : { purchased_reward_unlock: true };

      const { error: updErr } = await admin
        .from("profiles")
        .update(patch)
        .eq("user_id", purchase.user_id);

      if (updErr) console.error("kashier-webhook: profile unlock failed", updErr);
    }

    return new Response("OK", { status: 200 });
  } catch (e) {
    console.error("kashier-webhook error", e);
    return new Response("Internal error", { status: 500 });
  }
});

async function hmacSha256Hex(key: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(message));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}
