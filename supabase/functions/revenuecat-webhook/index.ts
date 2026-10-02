import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * Endpoint عام (بينادَى من سيرفرات RevenueCat مباشرة، مش من التطبيق) —
 * بيستقبل أحداث الشراء بعد ما جوجل بلاي تأكد الدفع فعليًا، ويفتح
 * الميزة على حساب صاحب الطلب:
 *
 *   - reward_unlock ناجح    → profiles.purchased_reward_unlock = true
 *   - no_interstitial ناجح → profiles.purchased_no_interstitial = true
 *   - no_ads ناجح           → profiles.purchased_no_ads = true
 *                             (وبيشمل أيضًا purchased_reward_unlock و
 *                             purchased_no_interstitial، لأن باقة الـ
 *                             50 جنيه أشمل حاجة وبتلغي كل الإعلانات)
 *
 * وبيسحب الميزة تاني لو حصل استرجاع فلوس (REFUND) أو إلغاء (CANCELLATION).
 *
 * ⚠️ إعداد لازم يتعمل يدويًا في لوحة RevenueCat (وليس في هذا الكود):
 *   1) روح RevenueCat Dashboard → Project → Integrations → Webhooks
 *   2) URL: …/functions/v1/revenuecat-webhook
 *   3) في "Authorization header value" حط نفس القيمة اللي هتحطها في
 *      سر REVENUECAT_WEBHOOK_SECRET بالأسفل (أي نص عشوائي طويل تختاره
 *      إنت بنفسك، ده مش مفتاح من عند RevenueCat، إنت اللي بتخترعه).
 *
 * ⚠️ شرط أساسي عشان app_user_id هنا يتطابق مع user_id بتاعنا في
 * profiles: لازم الكود في src/lib/billing.ts ينادي
 * Purchases.configure/logIn بنفس الـ user.id بتاع Supabase قبل أي
 * عملية شراء — لو المستخدم مش مسجّل دخول وقت الشراء، RevenueCat
 * هيديله معرّف "anonymous" مؤقت ومش هنقدر نربط الشراء بحسابه.
 *
 * ⚠️ شكل الـ payload هنا مطابق لتوثيق RevenueCat الرسمي وقت الكتابة
 * (Webhooks → Sample events)، لكن الأفضل تتأكد من الـ payload
 * الحقيقي اللي بيوصلك (Supabase → Edge Functions → Logs) بعد أول
 * عملية شراء تجريبية قبل ما تعتمد عليه بشكل نهائي.
 */

interface RevenueCatEvent {
  type?: string;
  app_user_id?: string;
  product_id?: string;
  id?: string;
  price?: number;
  currency?: string;
  environment?: string;
}

const STATIC_PRICE_EGP: Record<string, number> = {
  reward_unlock: 30,
  no_interstitial: 30,
  no_ads: 50,
  answers_100: 50,
  answers_200: 100,
};

const RIDDLE_ANSWER_PRODUCTS: Record<string, number> = {
  answers_100: 100,
  answers_200: 200,
};

const REVOKE_EVENT_TYPES = new Set(["CANCELLATION", "REFUND", "REVOKE"]);
const GRANT_EVENT_TYPES = new Set(["INITIAL_PURCHASE", "NON_RENEWING_PURCHASE", "RENEWAL"]);

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

    const webhookSecret = Deno.env.get("REVENUECAT_WEBHOOK_SECRET");
    if (!webhookSecret) {
      console.error("REVENUECAT_WEBHOOK_SECRET not configured");
      return new Response("Not configured", { status: 503 });
    }

    const authHeader = req.headers.get("Authorization") || "";
    if (!timingSafeEqual(authHeader, `Bearer ${webhookSecret}`) && !timingSafeEqual(authHeader, webhookSecret)) {
      console.error("revenuecat-webhook: invalid Authorization header");
      return new Response("Unauthorized", { status: 401 });
    }

    const raw = await req.text();
    let body: { event?: RevenueCatEvent };
    try {
      body = JSON.parse(raw);
    } catch {
      return new Response("Invalid JSON", { status: 400 });
    }

    const event = body.event;
    if (!event) return new Response("Missing event", { status: 400 });

    const eventType = String(event.type ?? "");
    const appUserId = event.app_user_id ?? "";
    const productId = event.product_id ?? "";
    const eventId = event.id ?? crypto.randomUUID();

    if (!appUserId || appUserId.startsWith("$RCAnonymousID:")) {
      console.error("revenuecat-webhook: anonymous or missing app_user_id, skipping", appUserId);
      // نرجع 200 عشان RevenueCat میعیدش یبعت — المشكلة عندنا في
      // ترتيب استدعاء configure/logIn قبل الشراء مش في الإشعار نفسه.
      return new Response("Anonymous user, ignored", { status: 200 });
    }

    const knownProducts = ["reward_unlock", "no_interstitial", "no_ads", "answers_100", "answers_200"];
    if (!knownProducts.includes(productId)) {
      console.error("revenuecat-webhook: unknown product_id", productId);
      return new Response("Unknown product", { status: 200 });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Idempotency: لو الحدث ده اتعالج قبل كده (RevenueCat ممكن يعيد
    // إرسال نفس الإشعار أكتر من مرة) متعملش حاجة تاني.
    const orderId = `rc_${eventId}`;
    const { data: existing } = await admin
      .from("purchases")
      .select("order_id, status")
      .eq("order_id", orderId)
      .maybeSingle();

    if (existing?.status === "success") {
      return new Response("OK (already processed)", { status: 200 });
    }

    const isGrant = GRANT_EVENT_TYPES.has(eventType);
    const isRevoke = REVOKE_EVENT_TYPES.has(eventType);

    if (!isGrant && !isRevoke) {
      // أنواع تانية من الأحداث (زي BILLING_ISSUE أو TRANSFER) —
      // بنسجلها بس من غير ما نغيّر أي صلاحية.
      return new Response("OK (ignored event type)", { status: 200 });
    }

    // ------------------------------------------------------------
    // منتجات "شراء الإجابات" ليها منطق مختلف تمامًا عن باقي المنتجات
    // (مش مجرد boolean على profiles — لازم نربط بـ intent ونحدّث
    // تقدم المشتري ونعلّم البائع ونبعتله إشعار).
    // ------------------------------------------------------------
    if (RIDDLE_ANSWER_PRODUCTS[productId] !== undefined) {
      const tier = RIDDLE_ANSWER_PRODUCTS[productId];

      await admin.from("purchases").upsert({
        order_id: orderId,
        user_id: appUserId,
        product: productId,
        amount_egp: event.price ?? STATIC_PRICE_EGP[productId] ?? 0,
        status: isGrant ? "success" : "failed",
        gateway_reference: eventId,
        updated_at: new Date().toISOString(),
      });

      if (!isGrant) {
        // استرجاع فلوس على شراء إجابات — منسحبش التقدم اللي اتفتح
        // بالفعل (المستخدم ممكن يكون كمّل ألغاز جداد فوقه)، بس نسجل
        // الفشل في purchases فوق ونوقف هنا.
        return new Response("OK (refund logged, progress kept)", { status: 200 });
      }

      // آخر intent غير مستهلك لنفس المشتري ونفس الشريحة
      const { data: intent } = await admin
        .from("riddle_purchase_intents")
        .select("*")
        .eq("buyer_id", appUserId)
        .eq("tier", tier)
        .eq("consumed", false)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const sellerId: string | null = intent?.seller_id ?? null;
      const offerId: string | null = intent?.offer_id ?? null;
      const amount = STATIC_PRICE_EGP[productId] ?? (tier === 100 ? 50 : 100);
      const payout = sellerId ? amount * 0.5 : 0;

      await admin.from("riddle_sale_purchases").insert({
        offer_id: offerId,
        seller_id: sellerId,
        buyer_id: appUserId,
        tier,
        amount_egp: amount,
        seller_payout_egp: payout,
        payout_status: sellerId ? "pending" : "not_applicable",
        order_id: orderId,
      });

      if (intent) {
        await admin.from("riddle_purchase_intents").update({ consumed: true }).eq("id", intent.id);
      }

      // فتح التقدم فعليًا للمشتري: يقفز مباشرة بعد الشريحة، وتتحسب
      // له كل الإجابات اللي فاتته صحيحة في نقاطه أيضًا.
      const { data: buyerProfile } = await admin
        .from("profiles")
        .select("last_puzzle_index, saved_score, riddle_unlock_offset")
        .eq("user_id", appUserId)
        .maybeSingle();
      const prevIndex = buyerProfile?.last_puzzle_index ?? 0;
      const prevScore = buyerProfile?.saved_score ?? 0;
      if (prevIndex < tier) {
        await admin.from("profiles").update({
          last_puzzle_index: tier,
          saved_score: Math.max(prevScore, tier),
          riddle_unlock_offset: Math.max(buyerProfile?.riddle_unlock_offset ?? 0, tier),
          updated_at: new Date().toISOString(),
        }).eq("user_id", appUserId);
      }

      // إشعار فوري للبائع الحقيقي (لو مفيش بائع، يبقى صاحب التطبيق هو اللي باع)
      if (sellerId) {
        await notifySeller(admin, sellerId, tier, amount, payout);
      }

      return new Response("OK", { status: 200 });
    }

    await admin.from("purchases").upsert({
      order_id: orderId,
      user_id: appUserId,
      product: productId,
      amount_egp: event.price ?? STATIC_PRICE_EGP[productId] ?? 0,
      status: isGrant ? "success" : "failed",
      gateway_reference: eventId,
      updated_at: new Date().toISOString(),
    });

    let patch: Record<string, boolean>;
    if (isGrant) {
      switch (productId) {
        case "no_ads":
          patch = { purchased_no_ads: true, purchased_reward_unlock: true, purchased_no_interstitial: true };
          break;
        case "no_interstitial":
          patch = { purchased_no_interstitial: true };
          break;
        default:
          patch = { purchased_reward_unlock: true };
      }
    } else {
      // استرجاع/إلغاء: نسحب بس نفس الميزة اللي اتلغت (مش كل حاجة).
      switch (productId) {
        case "no_ads":
          patch = { purchased_no_ads: false };
          break;
        case "no_interstitial":
          patch = { purchased_no_interstitial: false };
          break;
        default:
          patch = { purchased_reward_unlock: false };
      }
    }

    const { error: updErr } = await admin.from("profiles").update(patch).eq("user_id", appUserId);
    if (updErr) console.error("revenuecat-webhook: profile update failed", updErr);

    return new Response("OK", { status: 200 });
  } catch (e) {
    console.error("revenuecat-webhook error", e);
    return new Response("Internal error", { status: 500 });
  }
});

/**
 * إشعار push مباشر للبائع لحظة ما حد يشتري منه. بنص بسيط وواضح
 * يدّي إحساس فوري بالربح (رقم المبلغ ظاهر) عشان يشجّع البائع يكمل
 * لحد العتبة الجاية (200).
 */
async function notifySeller(
  admin: ReturnType<typeof createClient>,
  sellerId: string,
  tier: number,
  amountEgp: number,
  payoutEgp: number,
) {
  try {
    const { data: tokens } = await admin
      .from("device_tokens")
      .select("id, token")
      .eq("user_id", sellerId)
      .eq("platform", "web");
    if (!tokens || tokens.length === 0) return;

    const webpush = await import("npm:web-push@3.6.7");
    webpush.default.setVapidDetails(
      Deno.env.get("VAPID_SUBJECT") ?? "mailto:support@example.com",
      Deno.env.get("VAPID_PUBLIC_KEY")!,
      Deno.env.get("VAPID_PRIVATE_KEY")!,
    );

    const title = "🎉 مبيعات جديدة!";
    const body = `تم بيع إجاباتك (أول ${tier}) وحصلت على ${payoutEgp} جنيه من إجمالي ${amountEgp} جنيه. تواصل مع خدمة العملاء لاستلامها.`;
    const staleIds: string[] = [];

    for (const row of tokens) {
      try {
        const subscription = JSON.parse(row.token as string);
        await webpush.default.sendNotification(
          subscription,
          JSON.stringify({ title, body, url: "/" }),
        );
      } catch (err: any) {
        if (err?.statusCode === 404 || err?.statusCode === 410) staleIds.push(row.id as string);
      }
    }
    if (staleIds.length > 0) {
      await admin.from("device_tokens").delete().in("id", staleIds);
    }
  } catch (e) {
    console.error("notifySeller failed", e);
  }
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}
