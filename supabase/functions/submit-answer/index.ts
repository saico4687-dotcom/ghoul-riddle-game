import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

// Server-side answer key for the 400 riddles (matches order of src/data/riddles.ts).
// This is the single source of truth — clients cannot influence correctness.
const ANSWERS: number[] = [0,1,1,0,2,1,0,2,1,0,3,1,1,1,2,2,1,2,1,2,2,2,0,1,1,1,1,1,1,1,2,3,1,1,1,1,1,1,1,3,1,3,3,1,1,0,3,2,3,2,1,1,1,0,1,1,1,1,1,2,1,0,0,2,0,1,1,1,0,0,1,2,1,0,2,0,0,0,2,1,0,0,1,1,2,0,0,2,1,2,1,1,1,0,1,2,0,3,0,1,2,2,1,0,2,2,1,1,1,1,1,2,2,1,1,1,2,1,1,1,1,0,0,1,1,1,1,1,1,1,0,1,2,3,0,1,2,1,0,1,1,2,1,2,1,0,1,1,1,1,1,1,1,1,0,0,0,1,3,1,1,2,1,1,1,0,1,0,1,1,1,1,0,1,1,0,0,1,0,1,1,1,1,3,1,1,1,1,2,1,1,1,1,1,0,1,2,1,1,1,1,1,1,2,1,2,1,1,1,2,1,1,1,1,3,1,1,1,1,1,1,1,1,1,1,2,1,1,1,1,1,1,1,1,1,1,1,1,1,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,3,1,1,1,1,1,1,1,1,1,1,0,1,0,1,1,1,1,1,0,1,1,1,1,0,0,1,0,1,0,1,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1];

const TOTAL_RIDDLES = ANSWERS.length;
const QUESTION_TIMER_MS = 60_000; // matches client timer (60s)
const MIN_ANSWER_MS = 250; // anti-bot floor

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // --- Auth ---
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

    // --- Input validation ---
    let body: unknown;
    try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
    const b = body as Record<string, unknown>;
    const riddleIndex = Number(b.riddle_index); // 0-based
    const selectedIndex = b.selected_index === null ? null : Number(b.selected_index);
    const elapsedMs = b.elapsed_ms === undefined ? null : Number(b.elapsed_ms);

    if (!Number.isInteger(riddleIndex) || riddleIndex < 0 || riddleIndex >= TOTAL_RIDDLES) {
      return json({ error: "Invalid riddle_index" }, 400);
    }
    if (selectedIndex !== null && (!Number.isInteger(selectedIndex) || selectedIndex < 0 || selectedIndex > 3)) {
      return json({ error: "Invalid selected_index" }, 400);
    }
    if (elapsedMs !== null && (!Number.isFinite(elapsedMs) || elapsedMs < 0)) {
      return json({ error: "Invalid elapsed_ms" }, 400);
    }

    // --- Service-role client for trusted writes ---
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // --- Load current profile (server is source of truth) ---
    const { data: profile, error: pErr } = await admin
      .from("profiles")
      .select("user_id, last_puzzle_index, saved_score, saved_total_points, saved_time_bonus")
      .eq("user_id", userId)
      .maybeSingle();
    if (pErr) return json({ error: "Profile lookup failed" }, 500);
    if (!profile) return json({ error: "Profile missing" }, 404);

    // Enforce sequential progression — block replay/skip attacks
    const expectedIndex = profile.last_puzzle_index ?? 0;
    if (riddleIndex !== expectedIndex) {
      return json({
        error: "Out of order",
        expected_index: expectedIndex,
      }, 409);
    }

    // --- Server-side correctness check ---
    const correctIndex = ANSWERS[riddleIndex];
    const isCorrect = selectedIndex !== null && selectedIndex === correctIndex;

    // --- Server-side scoring ---
    let pointsEarned = 0;
    let bonusEarned = 0;
    if (isCorrect) {
      pointsEarned = 10;
      // Clamp elapsedMs to plausible range, then derive remaining time
      if (elapsedMs !== null && elapsedMs >= MIN_ANSWER_MS && elapsedMs <= QUESTION_TIMER_MS) {
        const remainingSec = Math.max(0, Math.floor((QUESTION_TIMER_MS - elapsedMs) / 1000));
        bonusEarned = Math.min(5, Math.floor(remainingSec / 12));
        pointsEarned += bonusEarned;
      }
    }

    const newScore = (profile.saved_score ?? 0) + (isCorrect ? 1 : 0);
    const newTotalPoints = (profile.saved_total_points ?? 0) + pointsEarned;
    const newTimeBonus = (profile.saved_time_bonus ?? 0) + bonusEarned;
    const nextIndex = riddleIndex + 1;

    // --- Persist (service role bypasses revoked GRANTs) ---
    const { error: uErr } = await admin
      .from("profiles")
      .update({
        last_puzzle_index: nextIndex,
        saved_score: newScore,
        saved_total_points: newTotalPoints,
        saved_time_bonus: newTimeBonus,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);
    if (uErr) return json({ error: "Update failed" }, 500);

    // Log timing (best effort, server-side only)
    if (elapsedMs !== null && elapsedMs >= 0) {
      const clamped = Math.min(elapsedMs, QUESTION_TIMER_MS);
      await admin.from("answer_times").insert({
        user_id: userId,
        riddle_index: riddleIndex + 1,
        elapsed_ms: clamped,
        game_mode: "fun",
      });
    }

    return json({
      isCorrect,
      correctIndex,
      pointsEarned,
      bonusEarned,
      score: newScore,
      totalPoints: newTotalPoints,
      timeBonus: newTimeBonus,
      nextIndex,
      finished: nextIndex >= TOTAL_RIDDLES,
    }, 200);
  } catch (e) {
    console.error("submit-answer error", e);
    return json({ error: "Internal error" }, 500);
  }
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
