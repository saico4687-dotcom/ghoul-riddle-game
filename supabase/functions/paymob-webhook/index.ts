import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * Endpoint عام (بيتنادى من سيرفرات بايموب مباشرة، مش من التطبيق) —
 * بيستقبل "Transaction Processed Callback"، يتحقق من توقيع HMAC،
 * ثم يفتح الميزة فعليًا على حساب صاحب الطلب:
 *
 *   - reward_unlock ناجح    → profiles.purchased_reward_unlock = true
 *   - no_interstitial ناجح → profiles.purchased_no_interstitial = true
 *   - no_ads ناجح           → profiles.purchased_no_ads = true
 *                             (وبيشمل أيضًا purchased_reward_unlock و
 *                             purchased_no_interstitial، لأن باقة الـ
 *                             50 جنيه أشمل حاجة وبتلغي كل الإعلانات)
 *
 * التحقق من التوقيع هنا مطابق لتوثيق بايموب الرسمي وقت الكتابة
 * (developers.paymob.com → Transaction Callbacks → HMAC Calculation):
 *   1) بايموب بيبعت hmac كـ query parameter على رابط الويبهوك نفسه
 *      (مش هيدر زي كاشير).
 *   2) بنركّب سترينج من قيم الحقول دي بالترتيب ده بالظبط:
 *      amount_cents, created_at, currency, error_occured,
 *      has_parent_transaction, id, integration_id, is_3d_secure,
 *      is_auth, is_capture, is_refunded, is_standalone_payment,
 *      is_voided, order.id, owner, pending, source_data.pan,
 *      source_data.sub_type, source_data.type, success
 *   3) HMAC-SHA512 للسترينج ده بمفتاح PAYMOB_HMAC_SECRET (مفتاح
 *      مختلف تمامًا عن PAYMOB_SECRET_KEY بتاع إنشاء الدفع — موجود في
 *      تبويب "Profile" في لوحة بايموب).
 *   4) نقارنه (hex lowercase) بقيمة hmac اللي جت في الـ query string.
 *
 * ⚠️ الحقول والصيغة دي مطابقة لتوثيق بايموب وقت الكتابة، لكن بايموب
 * بيفرّق أحيانًا بين شكل "Transaction Processed Callback" و"Transaction
 * Response Callback" (المستخدم لصفحة الرجوع بالمتصفح، مش لسيرفر
 * لسيرفر). اختبر Sandbox فعليًا وقارن الـ payload الحقيقي اللي بيوصلك
 * بالكود ده قبل التفعيل على الإنتاج، وعدّل المسارات (obj.order.id
 * وغيرها) لو لقيت اختلاف — راجع developers.paymob.com.
 *
 * ⚠️ لازم تحط رابط الفنكشن ده (…/functions/v1/paymob-webhook) في
 * لوحة بايموب كـ "Transaction Processed Callback URL" (Developers →
 * Payment Integrations).
 */

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

    const hmacSecret = Deno.env.get("PAYMOB_HMAC_SECRET");
    if (!hmacSecret) {
      console.error("PAYMOB_HMAC_SECRET not configured");
      return new Response("Not configured", { status: 503 });
    }

    const url = new URL(req.url);
    const receivedHmac = (url.searchParams.get("hmac") || "").toLowerCase();

    const raw = await req.text();
    let body: { obj?: Record<string, unknown>; type?: string };
    try {
      body = JSON.parse(raw);
    } catch {
      return new Response("Invalid JSON", { status: 400 });
    }

    const obj = body.obj;
    if (!obj) return new Response("Missing obj", { status: 400 });

    const orderObj = (obj.order as Record<string, unknown>) || {};
    const sourceData = (obj.source_data as Record<string, unknown>) || {};

    // ترتيب الحقول ده حرفي حسب توثيق بايموب — ممنوع تغييره.
    const flatFieldsInOrder = [
      "amount_cents", "created_at", "currency", "error_occured",
      "has_parent_transaction", "id", "integration_id", "is_3d_secure",
      "is_auth", "is_capture", "is_refunded", "is_standalone_payment",
      "is_voided",
    ];
    const values = flatFieldsInOrder.map((k) => String(obj[k] ?? ""));
    values.push(String(orderObj["id"] ?? ""));
    values.push(String(obj["owner"] ?? ""));
    values.push(String(obj["pending"] ?? ""));
    values.push(String(sourceData["pan"] ?? ""));
    values.push(String(sourceData["sub_type"] ?? ""));
    values.push(String(sourceData["type"] ?? ""));
    values.push(String(obj["success"] ?? ""));

    const concatenated = values.join("");
    const expected = await hmacSha512Hex(hmacSecret, concatenated);

    if (!receivedHmac || !timingSafeEqual(receivedHmac, expected)) {
      console.error("paymob-webhook: invalid signature");
      return new Response("Invalid signature", { status: 401 });
    }

    // special_reference هو orderId بتاعنا اللي بعتناه وقت إنشاء الـ
    // intention؛ بايموب بيرجّعه هنا جوه order.merchant_order_id.
    const orderId = String(orderObj["merchant_order_id"] ?? "");
    const success = obj["success"] === true;
    const reference = obj["id"] != null ? String(obj["id"]) : null;

    if (!orderId) return new Response("Missing merchant_order_id", { status: 400 });

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
      console.error("paymob-webhook: unknown order", orderId, findErr);
      // نرجع 200 برضه عشان بايموب ميعيدش يبعت الإشعار كل شوية لطلب
      // مش موجود عندنا أصلاً (مش خطأ عندهم).
      return new Response("Unknown order", { status: 200 });
    }

    // Idempotency: لو الطلب اتعالج قبل كده كـ success متعملش حاجة تاني
    // (بايموب ممكن يبعت الويبهوك أكتر من مرة لنفس المعاملة).
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

      if (updErr) console.error("paymob-webhook: profile unlock failed", updErr);
    }

    return new Response("OK", { status: 200 });
  } catch (e) {
    console.error("paymob-webhook error", e);
    return new Response("Internal error", { status: 500 });
  }
});

async function hmacSha512Hex(key: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(key),
    { name: "HMAC", hash: "SHA-512" },
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
