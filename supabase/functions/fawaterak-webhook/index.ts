import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * Endpoint عام (بيتنادى من سيرفرات Fawaterak مباشرة، مش من التطبيق) —
 * بيستقبل "Paid transactions webhook"، يتحقق من توقيع hashKey، ثم
 * يفتح الميزة فعليًا على حساب صاحب الطلب. نفس فكرة paymob-webhook
 * بالظبط، بس بصيغة توقيع مختلفة.
 *
 * شكل الـ body حسب توثيق Fawaterak (fawaterak-api.readme.io → Web Hook)
 * وقت الكتابة:
 *   {
 *     "hashKey": "...",
 *     "invoice_key": "...",
 *     "invoice_id": 1000430,
 *     "payment_method": "Fawry",
 *     "invoice_status": "paid",
 *     "pay_load": {...} أو null,
 *     "referenceNumber": "..."
 *   }
 *
 * ⚠️ التحقق من التوقيع هنا مبني على أفضل معرفة متاحة من التوثيق وقت
 * الكتابة، لكن التوثيق كان غامض شوية في ترتيب الحقول بالظبط. **لازم
 * تتأكد بنفسك** بطباعة الـ raw body والـ hashKey في اللوج أول مرة
 * يوصل ويبهوك حقيقي، وتقارنه بالـ hash المحسوب هنا، قبل ما تعتمد
 * عليه في الإنتاج. لو مختلف، عدّل ترتيب/أسماء الحقول في
 * buildSignedString تحت.
 *
 * ⚠️ لازم تحط رابط الفنكشن ده (…/functions/v1/fawaterak-webhook) في
 * لوحة Fawaterak → Integrations → "Paid transactions webhook".
 */

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

    const vendorKey = Deno.env.get("FAWATERAK_VENDOR_KEY");
    if (!vendorKey) {
      console.error("FAWATERAK_VENDOR_KEY not configured");
      return new Response("Not configured", { status: 503 });
    }

    const raw = await req.text();
    let body: {
      hashKey?: string;
      invoice_key?: string;
      invoice_id?: number | string;
      payment_method?: string;
      invoice_status?: string;
      pay_load?: { order_id?: string; product?: string } | null;
      referenceNumber?: string;
    };
    try {
      body = JSON.parse(raw);
    } catch {
      return new Response("Invalid JSON", { status: 400 });
    }

    // اللوج ده مهم جدًا أول مرة — امسحه أو خففه بعد ما تتأكد إن
    // التحقق من التوقيع شغال صح على الإنتاج.
    console.log("fawaterak-webhook raw payload", raw);

    const receivedHash = (body.hashKey || "").toLowerCase();
    const signedString =
      `InvoiceId=${body.invoice_id ?? ""}` +
      `&InvoiceKey=${body.invoice_key ?? ""}` +
      `&PaymentMethod=${body.payment_method ?? ""}`;
    const expected = await hmacSha256Hex(vendorKey, signedString);

    if (!receivedHash || !timingSafeEqual(receivedHash, expected)) {
      console.error("fawaterak-webhook: invalid signature", { signedString, expected, receivedHash });
      return new Response("Invalid signature", { status: 401 });
    }

    const orderId = body.pay_load?.order_id;
    const success = body.invoice_status === "paid";
    const reference = body.referenceNumber ?? (body.invoice_id != null ? String(body.invoice_id) : null);

    if (!orderId) return new Response("Missing order_id in pay_load", { status: 400 });

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
      console.error("fawaterak-webhook: unknown order", orderId, findErr);
      // نرجع 200 برضه عشان Fawaterak ميعيدش يبعت الإشعار كل شوية
      // لطلب مش موجود عندنا أصلاً (مش خطأ عندهم).
      return new Response("Unknown order", { status: 200 });
    }

    // Idempotency: لو الطلب اتعالج قبل كده كـ success متعملش حاجة
    // تاني (Fawaterak ممكن يبعت الويبهوك أكتر من مرة لنفس المعاملة).
    if (purchase.status === "success") {
      return new Response("OK", { status: 200 });
    }

    await admin
      .from("purchases")
      .update({
        status: success ? "success" : "failed",
        gateway_reference: reference,
        updated_at: new Date().toISOString(),
      })
      .eq("order_id", orderId);

    if (success) {
      let patch: Record<string, boolean>;
      switch (purchase.product) {
        case "no_ads":
          patch = {
            purchased_no_ads: true,
            purchased_reward_unlock: true,
            purchased_no_interstitial: true,
          };
          break;
        case "no_interstitial":
          patch = { purchased_no_interstitial: true };
          break;
        default:
          patch = { purchased_reward_unlock: true };
      }

      const { error: updErr } = await admin
        .from("profiles")
        .update(patch)
        .eq("user_id", purchase.user_id);

      if (updErr) console.error("fawaterak-webhook: profile unlock failed", updErr);
    }

    return new Response("OK", { status: 200 });
  } catch (e) {
    console.error("fawaterak-webhook error", e);
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
