import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

/**
 * بيرجّع رابط صفحة دفع كاشير (Hosted Payment Page) جاهز لمنتج
 * "reward_unlock" (30 جنيه) أو "no_ads" (50 جنيه)، ويسجّل عملية
 * الشراء كـ "pending" في جدول purchases عشان الويبهوك يقدر يربطها
 * لاحقًا بصاحبها بأمان (السيرفر هو مصدر الحقيقة، مش الكلاينت).
 *
 * ⚠️ لازم تضبط الأسرار دي في Supabase (Project Settings → Edge
 * Functions → Secrets) قبل ما الدفع يشتغل فعليًا:
 *   - KASHIER_MERCHANT_ID   (معرّف التاجر من لوحة كاشير)
 *   - KASHIER_API_KEY       (Payment API Key — يُستخدم لحساب الـ hash فقط، سري تمامًا)
 *   - KASHIER_MODE          ("test" أو "live")
 *
 * صيغة حساب الـ hash هنا مطابقة لتوثيق كاشير الرسمي وقت الكتابة؛
 * لو كاشير غيّروا الصيغة راجع https://developers.kashier.io قبل
 * التفعيل على الإنتاج.
 */

const PRODUCTS: Record<string, { amount: number; label: string }> = {
  reward_unlock: { amount: 30, label: "فتح ميزة المكافأة" },
  no_ads: { amount: 50, label: "إلغاء الإعلانات" },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims?.sub) {
      return json({ error: "Unauthorized" }, 401);
    }
    const userId = claimsData.claims.sub as string;

    let body: unknown;
    try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
    const product = (body as Record<string, unknown>)?.product;
    if (typeof product !== "string" || !PRODUCTS[product]) {
      return json({ error: "Invalid product" }, 400);
    }

    const merchantId = Deno.env.get("KASHIER_MERCHANT_ID");
    const apiKey = Deno.env.get("KASHIER_API_KEY");
    const mode = Deno.env.get("KASHIER_MODE") || "test";
    if (!merchantId || !apiKey) {
      return json({ error: "Payment gateway not configured yet" }, 503);
    }

    const { amount } = PRODUCTS[product];
    const currency = "EGP";
    const orderId = `${userId}-${product}-${Date.now()}`;

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { error: insertErr } = await admin.from("purchases").insert({
      order_id: orderId,
      user_id: userId,
      product,
      amount_egp: amount,
      status: "pending",
    });
    if (insertErr) {
      console.error("purchases insert failed", insertErr);
      return json({ error: "Could not start payment" }, 500);
    }

    // صيغة كاشير الرسمية (developers.kashier.io/payment/payment-page):
    // hash = HMAC-SHA256("/?payment=merchantId.orderId.amount.currency", apiKey) بصيغة hex
    const path = `/?payment=${merchantId}.${orderId}.${amount}.${currency}`;
    const hash = await hmacSha256Hex(apiKey, path);

    // رابط الرجوع لداخل التطبيق بعد الدفع (سكيم مخصّص com.rebh.app://)
    // — التطبيق يعترضه عن طريق Capacitor App plugin ويقفل المتصفح
    // الداخلي، بدل ما يسيب المستخدم برّه التطبيق.
    const merchantRedirect = "com.rebh.app://payment-result";

    const params = new URLSearchParams({
      merchantId,
      orderId,
      mode,
      amount: String(amount),
      currency,
      hash,
      merchantRedirect,
      allowedMethods: "card,wallet,bank_installments",
      display: "ar",
    });

    // ⚠️ نطاق صفحة الدفع المستضافة (HPP) هنا بأفضل معرفة متاحة وقت
    // الكتابة. تأكد منه بنفسك من لوحة كاشير (Integrate now → Hosted
    // Payment Page) أو من فريق الدعم الفني بتاعهم قبل التفعيل على
    // الإنتاج، لأن كاشير مش بتوثّقه بشكل صريح كـ base URL منفصل عن
    // كود الـ iframe.
    const paymentUrl = `https://checkout.kashier.io/?${params.toString()}`;

    return json({ paymentUrl, orderId });
  } catch (e) {
    console.error("create-kashier-payment error", e);
    return json({ error: "Internal error" }, 500);
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

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
