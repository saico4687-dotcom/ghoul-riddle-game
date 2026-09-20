import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

/**
 * ينادَى قبل فتح شاشة الدفع بتاعة Google Play مباشرة. بيحجز سلوت
 * عند بائع معيّن (أو "من غير بائع" = يشتري من صاحب التطبيق لو مفيش
 * عروض نشطة لسه)، ويرجّع intent_id. الكلاينت بعد كده يبدأ عملية
 * الشراء الحقيقية عبر src/lib/billing.ts، وبعد ما جوجل يأكد الدفع
 * يوصل الحدث لـ revenuecat-webhook اللي بيقرأ آخر intent غير
 * مستهلك بتاع نفس المستخدم/الشريحة عشان يعرف "اشترى من مين".
 *
 * الحجز هنا atomic (increment مشروط بـ slots_sold < slots_total)
 * عشان لو 3 ناس ضغطوا "اشترِ" على نفس البائع في نفس اللحظة، مايتباعش
 * أكتر من 10 سلوتات فعليًا.
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
    const buyerId = claims.claims.sub as string;

    let body: unknown;
    try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
    const b = body as Record<string, unknown>;
    const tier = Number(b.tier);
    const offerId = b.offer_id ? String(b.offer_id) : null; // null = عايز يشتري من صاحب التطبيق

    if (![100, 200].includes(tier)) return json({ error: "Invalid tier" }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // ما يشتريش شريحة هو أصلًا وصلها أو تخطاها بالفعل
    const { data: buyerProfile } = await admin
      .from("profiles")
      .select("last_puzzle_index, riddle_unlock_offset")
      .eq("user_id", buyerId)
      .maybeSingle();
    const already = Math.max(buyerProfile?.last_puzzle_index ?? 0, buyerProfile?.riddle_unlock_offset ?? 0);
    if (already >= tier) {
      return json({ error: "You already passed this milestone" }, 400);
    }

    let sellerId: string | null = null;
    let finalOfferId: string | null = null;

    if (offerId) {
      // حجز سلوت عند بائع حقيقي — increment مشروط ذرّي
      const { data: offer, error: offerErr } = await admin
        .from("riddle_sale_offers")
        .select("*")
        .eq("id", offerId)
        .maybeSingle();
      if (offerErr) return json({ error: "Offer lookup failed" }, 500);
      if (!offer || offer.status !== "active" || offer.tier !== tier) {
        return json({ error: "Offer not available" }, 400);
      }

      const { data: updated, error: incErr } = await admin
        .from("riddle_sale_offers")
        .update({
          slots_sold: offer.slots_sold + 1,
          status: offer.slots_sold + 1 >= offer.slots_total ? "sold_out" : "active",
        })
        .eq("id", offerId)
        .eq("slots_sold", offer.slots_sold) // optimistic lock — يفشل لو حد سبقه في نفس اللحظة
        .select()
        .maybeSingle();
      if (incErr || !updated) {
        return json({ error: "This offer just sold out, try another seller" }, 409);
      }
      sellerId = offer.seller_id;
      finalOfferId = offerId;
    }
    // لو offerId مفيش، بيفضل sellerId = null → يعني شراء من صاحب التطبيق مباشرة

    const price = tier === 100 ? 50 : 100;
    const { data: intent, error: intentErr } = await admin
      .from("riddle_purchase_intents")
      .insert({ buyer_id: buyerId, tier, offer_id: finalOfferId, seller_id: sellerId })
      .select("id")
      .single();
    if (intentErr) return json({ error: "Could not create intent" }, 500);

    return json({ intentId: intent.id, priceEgp: price, sellerId });
  } catch (e) {
    console.error("reserve-riddle-purchase error", e);
    return json({ error: "Internal error" }, 500);
  }
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
