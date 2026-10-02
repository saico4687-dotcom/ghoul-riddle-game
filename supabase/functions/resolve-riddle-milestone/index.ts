import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

/**
 * بينادَى من صفحة "مبروك! أنت من أوائل الفائزين" بعد ما المستخدم
 * يضغط "موافق" على الخيار الأول (يكمل) أو الثاني (يبيع). لو اختار
 * البيع بينشئ عرض بيع (riddle_sale_offers) بـ10 سلوتات. يسجّل إن
 * العتبة دي "اتحلت" عشان الصفحة ما تظهرش تاني لنفس المستخدم.
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
    const userId = claims.claims.sub as string;

    let body: unknown;
    try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
    const b = body as Record<string, unknown>;
    const tier = Number(b.tier);
    const choice = String(b.choice);

    if (![100, 200].includes(tier)) return json({ error: "Invalid tier" }, 400);
    if (!["continue", "sell"].includes(choice)) return json({ error: "Invalid choice" }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // تأكيد إن المستخدم فعلاً وصل للعتبة دي ولسه ماحلهاش (يمنع تلاعب من الكلاينت)
    const { data: profile, error: pErr } = await admin
      .from("profiles")
      .select("saved_score, milestone_100_resolved, milestone_200_resolved")
      .eq("user_id", userId)
      .maybeSingle();
    if (pErr || !profile) return json({ error: "Profile not found" }, 404);
    if ((profile.saved_score ?? 0) < tier) return json({ error: "Milestone not reached yet" }, 400);
    const alreadyResolved = tier === 100 ? profile.milestone_100_resolved : profile.milestone_200_resolved;
    if (alreadyResolved) return json({ error: "Already resolved" }, 409);

    if (choice === "sell") {
      const price = tier === 100 ? 50 : 100;
      const { error: offerErr } = await admin.from("riddle_sale_offers").insert({
        seller_id: userId,
        tier,
        price_egp: price,
        slots_total: 10,
        slots_sold: 0,
        status: "active",
      });
      // UNIQUE(seller_id, tier) بيمنع تكرار العرض لو المستخدم ضغط مرتين بالغلط
      if (offerErr && !String(offerErr.message).includes("duplicate")) {
        console.error("resolve-riddle-milestone: offer insert failed", offerErr);
        return json({ error: "Could not create offer" }, 500);
      }
    }

    const patch = tier === 100 ? { milestone_100_resolved: true } : { milestone_200_resolved: true };
    const { error: updErr } = await admin.from("profiles").update(patch).eq("user_id", userId);
    if (updErr) return json({ error: "Could not save choice" }, 500);

    return json({ ok: true, choice, tier });
  } catch (e) {
    console.error("resolve-riddle-milestone error", e);
    return json({ error: "Internal error" }, 500);
  }
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
