import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

/**
 * بيرجّع رابط صفحة دفع Fawaterak جاهز لمنتج "reward_unlock" (30 جنيه)
 * أو "no_ads" (50 جنيه)، ويسجّل عملية الشراء كـ "pending" في جدول
 * purchases عشان الويبهوك يقدر يربطها لاحقًا بصاحبها بأمان.
 *
 * ده بديل/إضافة لـ create-paymob-payment، مخصص أساسًا للمحفظة
 * الإلكترونية (فودافون كاش / اتصالات كاش) بما إن حساب بايموب لسه
 * مالوش Mobile Wallet integration مفعّل.
 *
 * ⚠️ لازم تضبط السر ده في Supabase (Project Settings → Edge
 * Functions → Secrets) قبل ما الدفع يشتغل فعليًا:
 *   - FAWATERAK_VENDOR_KEY  من لوحة Fawaterak → Integrations →
 *                           "HASH API key" (اسمها كده في الداشبورد)
 *
 * صيغة الـ API (POST /api/v2/createInvoiceLink) مطابقة لتوثيق
 * Fawaterak الرسمي وقت الكتابة (fawaterak-api.readme.io)؛ لو
 * Fawaterak غيّروا الصيغة راجع التوثيق قبل التفعيل على الإنتاج.
 *
 * ⚠️ حسابك حاليًا على بيئة Live (app.fawaterk.com) مش Test — يعني
 * أي دفعة هتتحصل بيها هتكون بفلوس حقيقية فعليًا.
 */

const PRODUCTS: Record<string, { amountEgp: number; label: string }> = {
  reward_unlock: { amountEgp: 30, label: "فتح ميزة المكافأة" },
  no_interstitial: { amountEgp: 30, label: "إلغاء إعلانات الفاصل" },
  no_ads: { amountEgp: 50, label: "إلغاء الإعلانات" },
};

const FAWATERAK_API_BASE = "https://app.fawaterk.com";

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

    const vendorKey = Deno.env.get("FAWATERAK_VENDOR_KEY");
    if (!vendorKey) {
      return json({ error: "Payment gateway not configured yet" }, 503);
    }

    const { amountEgp, label } = PRODUCTS[product];
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
      gateway: "fawaterak",
    });
    if (insertErr) {
      console.error("purchases insert failed", insertErr);
      return json({ error: "Could not start payment" }, 500);
    }

    // نفس سكيم الرجوع المستخدم مع بايموب (com.rebh.app://) عشان
    // نفس منطق الاعتراض في src/lib/paymob.ts يشتغل هنا كمان — راجع
    // src/lib/fawaterak.ts.
    const successUrl = "com.rebh.app://payment-result?status=success";
    const failUrl = "com.rebh.app://payment-result?status=fail";
    const pendingUrl = "com.rebh.app://payment-result?status=pending";

    const invoiceRes = await fetch(`${FAWATERAK_API_BASE}/api/v2/createInvoiceLink`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${vendorKey}`,
      },
      body: JSON.stringify({
        payment_method_id: 2, // كل وسائل الدفع المتاحة (كارت + محفظة)؛ عدّلها لو عايز تقصرها على المحفظة بس بعد ما تجيب رقمها من getPaymentmethods
        cartTotal: amountEgp,
        currency: "EGP",
        customer: {
          first_name: "Player",
          last_name: "Player",
          email: `user-${userId}@ghoulriddle.app`,
          phone: "0100000000",
          address: "Cairo, Egypt",
        },
        cartItems: [
          { name: label, price: amountEgp, quantity: 1 },
        ],
        redirectionUrls: {
          successUrl,
          failUrl,
          pendingUrl,
        },
        payLoad: { order_id: orderId, product },
      }),
    });

    if (!invoiceRes.ok) {
      const errText = await invoiceRes.text();
      console.error("fawaterak invoice failed", invoiceRes.status, errText);
      await admin.from("purchases").update({ status: "failed" }).eq("order_id", orderId);
      return json({ error: "Could not start payment" }, 500);
    }

    const invoiceData = await invoiceRes.json();
    // ⚠️ اسم الحقل بالظبط (paymentData.url أو data.url أو غيره) بأفضل
    // معرفة متاحة وقت الكتابة من توثيق Fawaterak — تأكد منه فعليًا من
    // أول استجابة حقيقية (اطبعها في اللوج) قبل التفعيل على الإنتاج.
    const paymentUrl =
      invoiceData?.data?.url ?? invoiceData?.data?.payment_data?.redirectTo ?? null;

    if (!paymentUrl) {
      console.error("fawaterak invoice: missing payment url in response", invoiceData);
      await admin.from("purchases").update({ status: "failed" }).eq("order_id", orderId);
      return json({ error: "Could not start payment" }, 500);
    }

    return json({ paymentUrl, orderId });
  } catch (e) {
    console.error("create-fawaterak-payment error", e);
    return json({ error: "Internal error" }, 500);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
