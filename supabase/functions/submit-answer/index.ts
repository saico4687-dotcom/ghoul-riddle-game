import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { ANSWERS, EXPLANATIONS } from "./answers.ts";
import {
  isAnswerCorrect,
  pickFiftyRemoval,
  QUESTION_TIMER_MS,
  rankedElapsed,
  scoreFor,
} from "./logic.ts";

// السيرفر هو الحكم الوحيد، والإجابات الصحيحة والشرح موجودين هنا بس (مش في التطبيق):
//  - "start":  بيسجّل ساعة السيرفر لحظة ما اللغز يبدأ (بعد انتهاء كتابة السؤال).
//  - "fifty":  بيختار إجابتين غلط يتشطبوا (مرة واحدة لكل لغز).
//  - "answer": بيحسب الزمن بساعته، ويصحّح بنص الاختيار، ويسجّل النقاط والزمن.
//              مفيش أي رد بيرجّع الإجابة الصحيحة؛ الشرح بيتبعت بس لو الإجابة صح.

const TOTAL_RIDDLES = ANSWERS.length;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // --- التحقق من المستخدم ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims?.sub) return json({ error: "Unauthorized" }, 401);
    const userId = claimsData.claims.sub as string;

    // --- فحص المدخلات ---
    let body: unknown;
    try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
    const b = body as Record<string, unknown>;
    const action = b.action;
    const riddleIndex = Number(b.riddle_index); // يبدأ من 0

    if (action !== "start" && action !== "answer" && action !== "fifty") {
      return json({ error: "Invalid action" }, 400);
    }
    if (!Number.isInteger(riddleIndex) || riddleIndex < 0 || riddleIndex >= TOTAL_RIDDLES) {
      return json({ error: "Invalid riddle_index" }, 400);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // --- بروفايل اللاعب (السيرفر هو مصدر الحقيقة) ---
    const { data: profile, error: pErr } = await admin
      .from("profiles")
      .select("user_id, last_puzzle_index, saved_score, saved_total_points, saved_time_bonus")
      .eq("user_id", userId)
      .maybeSingle();
    if (pErr) return json({ error: "Profile lookup failed" }, 500);
    if (!profile) return json({ error: "Profile missing" }, 404);

    const expectedIndex = profile.last_puzzle_index ?? 0;

    const readStart = () =>
      admin
        .from("riddle_starts")
        .select("started_at, answered_at, result, fifty_removed, unranked, pending_restart")
        .eq("user_id", userId)
        .eq("riddle_index", riddleIndex)
        .maybeSingle();

    // ================= START =================
    if (action === "start") {
      // لازم اللغز يكون هو اللغز الحالي للاعب — بيمنع القفز.
      if (riddleIndex !== expectedIndex) {
        return json({ error: "Out of order", expected_index: expectedIndex }, 409);
      }
      // مساعد رجع من مساعدة لاعب تاني: لغزه بيبدأ من الأول بساعة جديدة (مرة واحدة)،
      // واللغز ده متعلّم unranked فمش بيدخل ترتيب أسرع إجابة.
      const { data: restart } = await admin
        .from("riddle_starts")
        .update({ started_at: new Date().toISOString(), pending_restart: false })
        .eq("user_id", userId)
        .eq("riddle_index", riddleIndex)
        .eq("pending_restart", true)
        .is("answered_at", null)
        .select("user_id");
      if (restart && restart.length > 0) return json({ ok: true }, 200);

      // أول بداية هي اللي بتتحسب. لو اتنادت تاني الساعة مبتتصفّرش.
      const { error: sErr } = await admin
        .from("riddle_starts")
        .upsert(
          { user_id: userId, riddle_index: riddleIndex },
          { onConflict: "user_id,riddle_index", ignoreDuplicates: true },
        );
      if (sErr) return json({ error: "Start failed" }, 500);
      return json({ ok: true }, 200);
    }

    // ================= FIFTY =================
    if (action === "fifty") {
      const { data: row, error: rErr } = await readStart();
      if (rErr) return json({ error: "Start lookup failed" }, 500);
      if (!row) return json({ error: "Riddle not started" }, 409);
      if (row.answered_at) return json({ error: "Already answered" }, 409);

      // استخدمها قبل كده؟ نرجّع نفس الإجابتين (بتمنع كشف الإجابة بتكرار الطلب).
      if (row.fifty_removed) return json({ remove: row.fifty_removed }, 200);

      const remove = pickFiftyRemoval(b.options, ANSWERS[riddleIndex]);
      if (!remove) return json({ error: "Invalid options" }, 400);

      const { data: saved, error: fErr } = await admin
        .from("riddle_starts")
        .update({ fifty_removed: remove })
        .eq("user_id", userId)
        .eq("riddle_index", riddleIndex)
        .is("fifty_removed", null)
        .select("fifty_removed");
      if (fErr) return json({ error: "Save failed" }, 500);
      if (!saved || saved.length === 0) {
        // طلبين في نفس اللحظة: التاني يرجّع اللي اتحفظ.
        const { data: again } = await readStart();
        return json({ remove: again?.fifty_removed ?? remove }, 200);
      }
      return json({ remove: saved[0].fifty_removed }, 200);
    }

    // ================= ANSWER =================
    const rawSelected = b.selected_option;
    if (rawSelected !== null && rawSelected !== undefined && typeof rawSelected !== "string") {
      return json({ error: "Invalid selected_option" }, 400);
    }
    const selected = typeof rawSelected === "string" ? rawSelected.slice(0, 500) : null;

    let { data: startRow, error: rErr } = await readStart();
    if (rErr) return json({ error: "Start lookup failed" }, 500);

    // وصلت إجابة من غير "start" (نت ضعيف وقت بداية اللغز مثلًا): نقبلها للنقاط
    // بس مبنديهاش أي أفضلية في الزمن (بتتحسب كأنها خدت الوقت كله).
    let lateStart = false;
    if (!startRow) {
      if (riddleIndex !== expectedIndex) {
        return json({ error: "Out of order", expected_index: expectedIndex }, 409);
      }
      const { error: iErr } = await admin
        .from("riddle_starts")
        .upsert(
          { user_id: userId, riddle_index: riddleIndex },
          { onConflict: "user_id,riddle_index", ignoreDuplicates: true },
        );
      if (iErr) return json({ error: "Start failed" }, 500);
      lateStart = true;
      const again = await readStart();
      startRow = again.data;
      if (!startRow) return json({ error: "Start failed" }, 500);
    }

    // مساعد رجع من مساعدة وأجاب من غير ما "start" الجديد يوصل: بنعتبرها بداية متأخرة.
    if (startRow.pending_restart && !startRow.answered_at) lateStart = true;

    // اتجاوب قبل كده؟ نرجّع نفس النتيجة (آمن لو الرد الأول ضاع في الطريق).
    if (startRow.answered_at) {
      if (startRow.result) return json(startRow.result, 200);
      return json({ error: "Answer in progress" }, 409);
    }

    // نقفل اللغز مرة واحدة بس (حماية من الإرسال المتكرر في نفس اللحظة).
    const nowIso = new Date().toISOString();
    const { data: claimed, error: cErr } = await admin
      .from("riddle_starts")
      .update({ answered_at: nowIso, selected_option: selected })
      .eq("user_id", userId)
      .eq("riddle_index", riddleIndex)
      .is("answered_at", null)
      .select("started_at");
    if (cErr) return json({ error: "Claim failed" }, 500);
    if (!claimed || claimed.length === 0) return json({ error: "Answer in progress" }, 409);

    // الزمن بساعة السيرفر.
    const realElapsedMs = Math.max(0, Date.parse(nowIso) - Date.parse(claimed[0].started_at as string));
    const elapsedMs = lateStart ? QUESTION_TIMER_MS : realElapsedMs;

    const isCorrect = isAnswerCorrect(selected, ANSWERS[riddleIndex]);
    const { pointsEarned, bonusEarned } = scoreFor(isCorrect, elapsedMs);

    const newScore = (profile.saved_score ?? 0) + (isCorrect ? 1 : 0);
    const newTotalPoints = (profile.saved_total_points ?? 0) + pointsEarned;
    const newTimeBonus = (profile.saved_time_bonus ?? 0) + bonusEarned;
    // لو الموبايل سبق وسجّل التقدم للغز اللي بعده قبل ما ردّنا يوصل، منرجّعوش لورا.
    const nextIndex = Math.max(expectedIndex, riddleIndex + 1);

    const { error: uErr } = await admin
      .from("profiles")
      .update({
        last_puzzle_index: nextIndex,
        saved_score: newScore,
        saved_total_points: newTotalPoints,
        saved_time_bonus: newTimeBonus,
        updated_at: nowIso,
      })
      .eq("user_id", userId);
    if (uErr) return json({ error: "Update failed" }, 500);

    // سجل الأوقات اللي بيعتمد عليه الفايز الأسبوعي (is_correct مهم للترتيب).
    const { error: tErr } = await admin.from("answer_times").insert({
      user_id: userId,
      riddle_index: riddleIndex + 1,
      // لغز المساعد اللي اتقطع (unranked) بيتسجّل بأقصى زمن عشان ميدخلش ترتيب السرعة.
      elapsed_ms: startRow.unranked ? QUESTION_TIMER_MS : rankedElapsed(elapsedMs),
      game_mode: "fun",
      is_correct: isCorrect,
    });
    if (tErr) console.error("answer_times insert failed", tErr);

    // أول 100 / 200 إجابة صحيحة.
    let milestoneReached: 100 | 200 | null = null;
    if (isCorrect) {
      const { data: mProfile } = await admin
        .from("profiles")
        .select("milestone_100_resolved, milestone_200_resolved")
        .eq("user_id", userId)
        .maybeSingle();
      if (newScore === 100 && !mProfile?.milestone_100_resolved) milestoneReached = 100;
      else if (newScore === 200 && !mProfile?.milestone_200_resolved) milestoneReached = 200;
    }

    // رقم صوت الرد (1..5) بالترتيب: الصح حسب عدد الصح، والغلط حسب عدد الغلط (السيرفر هو اللي بيحدد).
    const REACTION_COUNT = 5;
    const seqN = isCorrect ? newScore : Math.max(1, nextIndex - newScore);
    const reactionNo = ((Math.max(1, seqN) - 1) % REACTION_COUNT) + 1;

    const payload = {
      reactionNo,
      isCorrect,
      explanation: isCorrect ? EXPLANATIONS[riddleIndex] : null,
      elapsedMs,
      pointsEarned,
      bonusEarned,
      score: newScore,
      totalPoints: newTotalPoints,
      timeBonus: newTimeBonus,
      nextIndex,
      finished: nextIndex >= TOTAL_RIDDLES,
      milestoneReached,
    };

    // نحفظ النتيجة عشان لو الرد ضاع والتطبيق أعاد الطلب يرجع له نفس الرد.
    const { error: resErr } = await admin
      .from("riddle_starts")
      .update({ result: payload })
      .eq("user_id", userId)
      .eq("riddle_index", riddleIndex);
    if (resErr) console.error("result save failed", resErr);

    return json(payload, 200);
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
