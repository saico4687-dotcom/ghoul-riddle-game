import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

/**
 * بيرجّع رابط صفحة دفع بايموب (Paymob Unified Checkout) جاهز لمنتج
 * "reward_unlock" (30 جنيه) أو "no_ads" (50 جنيه)، ويسجّل عملية
 * الشراء كـ "pending" في جدول purchases عشان الويبهوك يقدر يربطها
 * لاحقًا بصاحبها بأمان (السيرفر هو مصدر الحقيقة، مش الكلاينت).
 *
 * ⚠️ لازم تضبط الأسرار دي في Supabase (Project Settings → Edge
 * Functions → Secrets) قبل ما الدفع يشتغل فعليًا — كلها من لوحة
 * بايموب (paymob.com → Developers):
 *   - PAYMOB_SECRET_KEY     من "API Keys"، سري تمامًا، بيبدأ بـ sk_
 *   - PAYMOB_PUBLIC_KEY     من نفس الصفحة، بيبدأ بـ pk_ — آمن يظهر
 *                           في رابط الدفع اللي بيوصل للعميل
 *   - PAYMOB_INTEGRATION_ID معرّف الـ Integration بتاع وسيلة الدفع
 *                           اللي فعّلتها (محفظة إلكترونية)، من
 *                           "Payment Integrations"
 *   - PAYMOB_HMAC_SECRET    من تبويب "Profile" — بيُستخدم في
 *                           paymob-webhook بس (مش هنا)
 *
 * صيغة الـ Intention API (POST /v1/intention/) مطابقة لتوثيق بايموب
 * الرسمي وقت الكتابة (developers.paymob.com)؛ لو بايموب غيّروا
 * الصيغة راجع التوثيق قبل التفعيل على الإنتاج.
 */

const PRODUCTS: Record<string, { amountEgp: number; label: string }> = {
  reward_unlock: { amountEgp: 30, label: "فتح ميزة المكافأة" },
  no_ads: { amountEgp: 50, label: "إلغاء الإعلانات" },
};

const PAYMOB_API_BASE = "https://accept.paymob.com";

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

    const secretKey = Deno.env.get("PAYMOB_SECRET_KEY");
    const publicKey = Deno.env.get("PAYMOB_PUBLIC_KEY");
    const integrationId = Deno.env.get("PAYMOB_INTEGRATION_ID");
    if (!secretKey || !publicKey || !integrationId) {
      return json({ error: "Payment gateway not configured yet" }, 503);
    }

    const { amountEgp } = PRODUCTS[product];
    const amountCents = Math.round(amountEgp * 100);
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
      amount_egp: amountEgp,
      status: "pending",
    });
    if (insertErr) {
      console.error("purchases insert failed", insertErr);
      return json({ error: "Could not start payment" }, 500);
    }

    // رابط الرجوع لداخل التطبيق بعد الدفع (سكيم مخصّص com.rebh.app://)
    // — التطبيق يعترضه عن طريق Capacitor App plugin ويقفل المتصفح
    // الداخلي، بدل ما يسيب المستخدم برّه التطبيق. راجع src/lib/paymob.ts.
    const redirectionUrl = "com.rebh.app://payment-result";
    const webhookUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/paymob-webhook`;

    const intentionRes = await fetch(`${PAYMOB_API_BASE}/v1/intention/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Token ${secretKey}`,
      },
      body: JSON.stringify({
        amount: amountCents,
        currency,
        payment_methods: [Number(integrationId)],
        // بيانات فوترة placeholder — بايموب بيطلبها إلزاميًا حتى لو
        // مش هنعرضها للمستخدم في نموذج منفصل. لو حبيت تجمعها من
        // المستخدم فعليًا (اسم/تليفون حقيقي) قبل الدفع، مرّرها هنا
        // بدل الـ placeholders دي.
        billing_data: {
          first_name: "Player",
          last_name: "Player",
          email: `user-${userId}@ghoulriddle.app`,
          phone_number: "+201000000000",
          country: "EG",
        },
        special_reference: orderId,
        notification_url: webhookUrl,
        redirection_url: redirectionUrl,
        extras: { product },
      }),
    });

    if (!intentionRes.ok) {
      const errText = await intentionRes.text();
      console.error("paymob intention failed", intentionRes.status, errText);
      await admin.from("purchases").update({ status: "failed" }).eq("order_id", orderId);
      return json({ error: "Could not start payment" }, 500);
    }

    const intentionData = await intentionRes.json();
    const clientSecret = intentionData?.client_secret;
    if (!clientSecret) {
      console.error("paymob intention: missing client_secret", intentionData);
      await admin.from("purchases").update({ status: "failed" }).eq("order_id", orderId);
      return json({ error: "Could not start payment" }, 500);
    }

    // ⚠️ رابط الـ Unified Checkout هنا بأفضل معرفة متاحة وقت الكتابة
    // (developers.paymob.com). تأكد منه بنفسك من لوحة بايموب أو فريق
    // الدعم الفني بتاعهم قبل التفعيل على الإنتاج.
    const paymentUrl =
      `${PAYMOB_API_BASE}/unifiedcheckout/?publicKey=${encodeURIComponent(publicKey)}` +
      `&clientSecret=${encodeURIComponent(clientSecret)}`;

    return json({ paymentUrl, orderId });
  } catch (e) {
    console.error("create-paymob-payment error", e);
    return json({ error: "Internal error" }, 500);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
