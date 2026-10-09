import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { ANSWERS } from "../submit-answer/answers.ts";
import {
  asUuid,
  cairoDayStartIso,
  DAILY_ASK_CAP,
  DAILY_FRIEND_REQUEST_CAP,
  DAILY_HELP_CAP,
  displayName,
  FREE_RETRY_WINDOW_MS,
  createBlockedReason,
  helperReward,
  helperWrongInfo,
  isSameOption,
  normalizeKind,
  pointsForHelper,
  quotaFrom,
  sessionEndAfterVoiceStart,
  talkTimeline,
  MAX_FRIENDS_NOTIFIED,
  MAX_NOTIFIED,
  REQUEST_TTL_MS,
  PICK_GRACE_S,
  SESSION_TTL_MS,
  TALK_MAX_S,
  talkSecondsFor,
} from "./logic.ts";

// "استعين بصديق" — كل حاجة بتتم من السيرفر:
//  settings / set_available : خيار "أنا متاح للمساعدة".
//  inbox        : نبضة المساعد (بتقول إنه فاتح التطبيق) + الطلبات اللي وصلته.
//  availability : فيه مساعدين متاحين للغز ده؟ (والفرصة التانية من غير إعلان).
//  create       : فتح طلب مساعدة لحوالي 5 مساعدين.
//  accept       : أول مساعد يوافق ياخد الطلب.
//  pick         : المساعد بيبعت اختياره؛ السيرفر بيصحّحه ويدّيه النقاط.
//  status       : متابعة الطلب (للاعب والمساعد).
//  voice_ready  : الطرف بيبلّغ إن الصوت اتوصل (العدّاد بيبدأ لما الاتنين يبلّغوا).
//  cancel       : إلغاء.
// نوع الطلب: voice (صوت بإعلان، 5 يوميًا) أو hint (تلميح بدون صوت، باقي الـ 20).
// الإجابات الصحيحة مبتتبعتش لأي حد؛ المساعد بيعرف إنه صح بس لأنه كان حلّ اللغز قبل كده.

const TOTAL_RIDDLES = ANSWERS.length;

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
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims?.sub) return json({ error: "Unauthorized" }, 401);
    const userId = claimsData.claims.sub as string;

    let body: unknown;
    try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
    const b = (body ?? {}) as Record<string, unknown>;
    const action = typeof b.action === "string" ? b.action : "";

    // deno-lint-ignore no-explicit-any
    const admin: any = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const riddleIdx = (): number | null => {
      const n = Number(b.riddle_index);
      return Number.isInteger(n) && n >= 0 && n < TOTAL_RIDDLES ? n : null;
    };

    // ---------- خيار "أنا متاح للمساعدة" ----------
    if (action === "settings") {
      const { data } = await admin
        .from("helper_settings").select("available").eq("user_id", userId).maybeSingle();
      return json({ available: data?.available === true }, 200);
    }

    if (action === "set_available") {
      const available = b.available === true;
      const nowIso = new Date().toISOString();
      const { error } = await admin.from("helper_settings").upsert(
        { user_id: userId, available, last_ping: available ? nowIso : null, updated_at: nowIso },
        { onConflict: "user_id" },
      );
      if (error) return json({ error: "Save failed" }, 500);
      return json({ available }, 200);
    }

    // ---------- نبضة المساعد + الطلبات الواردة ----------
    if (action === "inbox") {
      const nowIso = new Date().toISOString();
      await expireStale(admin);
      await admin.from("helper_settings")
        .update({ last_ping: nowIso })
        .eq("user_id", userId).eq("available", true);

      const { data: pending } = await admin
        .from("help_requests")
        .select("id, asker_id, riddle_index, expires_at, kind")
        .eq("status", "open")
        .gt("expires_at", nowIso)
        .contains("notified_ids", [userId])
        .order("created_at", { ascending: true })
        .limit(3);

      const { data: activeRows } = await admin
        .from("help_requests")
        .select("id, asker_id, riddle_index, expires_at, kind")
        .eq("helper_id", userId).eq("status", "accepted")
        .limit(1);

      // طلبات الصداقة اللي اتبعتت من جوه شاشة المساعدة (بتظهر هنا من غير فتح صفحات الدردشة).
      const { data: frs } = await admin
        .from("friend_requests")
        .select("id, from_user")
        .eq("to_user", userId).eq("status", "pending")
        .order("created_at", { ascending: true })
        .limit(3);

      const ids = [
        ...(pending ?? []).map((r: { asker_id: string }) => r.asker_id),
        ...(activeRows ?? []).map((r: { asker_id: string }) => r.asker_id),
        ...(frs ?? []).map((r: { from_user: string }) => r.from_user),
      ];
      const people = await profilesFor(admin, ids);
      const now = Date.now();

      return json({
        pending: (pending ?? []).map((r: Row) => ({
          id: r.id,
          riddleIndex: r.riddle_index,
          kind: normalizeKind(r.kind),
          secondsLeft: Math.max(0, Math.ceil((Date.parse(r.expires_at) - now) / 1000)),
          asker: people.get(r.asker_id) ?? { username: displayName(null, r.asker_id), avatarUrl: null },
        })),
        active: activeRows?.length
          ? { id: activeRows[0].id, riddleIndex: activeRows[0].riddle_index, kind: normalizeKind(activeRows[0].kind) }
          : null,
        friendRequests: (frs ?? []).map((f: { id: string; from_user: string }) => ({
          id: f.id,
          from: people.get(f.from_user) ?? { username: displayName(null, f.from_user), avatarUrl: null },
        })),
      }, 200);
    }

    // ---------- فيه مساعدين؟ (+ الحصص اليومية) ----------
    if (action === "availability") {
      const idx = riddleIdx();
      if (idx === null) return json({ error: "Invalid riddle_index" }, 400);
      await expireStale(admin);

      const [voiceH, hintH] = await Promise.all([
        admin.rpc("help_eligible_helpers", { p_asker: userId, p_riddle: idx, p_limit: 50, p_kind: "voice" }),
        admin.rpc("help_eligible_helpers", { p_asker: userId, p_riddle: idx, p_limit: 50, p_kind: "hint" }),
      ]);
      if (voiceH.error || hintH.error) return json({ error: "Lookup failed" }, 500);

      const sinceIso = new Date(Date.now() - FREE_RETRY_WINDOW_MS).toISOString();
      const { data: retry } = await admin
        .from("help_requests").select("kind")
        .eq("asker_id", userId).eq("riddle_index", idx)
        .eq("status", "expired").eq("retry_used", false)
        .gte("created_at", sinceIso).limit(10);
      const retryKinds = new Set((retry ?? []).map((r: { kind: string }) => normalizeKind(r.kind)));

      const { data: todayRows } = await admin
        .from("help_requests").select("kind, status, helper_id")
        .eq("asker_id", userId).gte("created_at", cairoDayStartIso());
      const q = quotaFrom(todayRows ?? []);

      const voiceCount = (voiceH.data ?? []).length;
      const hintCount = (hintH.data ?? []).length;
      return json({
        voiceCount,
        hintCount,
        count: Math.max(voiceCount, hintCount),
        voiceLeft: q.voiceLeft,
        hintLeft: q.hintLeft,
        hintAdNeeded: q.hintAdNeeded,
        freeRetryVoice: retryKinds.has("voice"),
        freeRetryHint: retryKinds.has("hint"),
        freeRetry: retryKinds.size > 0,
        limitReached: q.total >= DAILY_ASK_CAP || (q.voiceLeft <= 0 && q.hintLeft <= 0),
      }, 200);
    }

    // ---------- فتح طلب ----------
    if (action === "create") {
      const idx = riddleIdx();
      if (idx === null) return json({ error: "Invalid riddle_index" }, 400);
      const kind = normalizeKind(b.kind);

      // لازم يكون اللغز الحالي للاعب وبدأ فعلًا ولسه ما اتجاوبش.
      const { data: prof } = await admin
        .from("profiles").select("last_puzzle_index, help_pass_tier, help_pass_until").eq("user_id", userId).maybeSingle();
      if (!prof || (prof.last_puzzle_index ?? 0) !== idx) return json({ error: "out_of_order" }, 409);

      const { data: st } = await admin
        .from("riddle_starts").select("answered_at")
        .eq("user_id", userId).eq("riddle_index", idx).maybeSingle();
      if (!st || st.answered_at) return json({ error: "not_started" }, 409);

      await expireStale(admin);

      const { data: active } = await admin
        .from("help_requests").select("id, riddle_index, status, session_key, expires_at, kind")
        .eq("asker_id", userId).in("status", ["open", "accepted"]).limit(1);
      if (active && active.length > 0) {
        const a = active[0];
        if (a.riddle_index === idx) {
          return json({
            id: a.id, sessionKey: a.session_key, status: a.status, expiresAt: a.expires_at, resumed: true,
            kind: normalizeKind(a.kind),
          }, 200);
        }
        await admin.from("help_requests").update({ status: "cancelled" }).eq("id", a.id);
      }

      const { data: done } = await admin
        .from("help_requests").select("id")
        .eq("asker_id", userId).eq("riddle_index", idx).eq("status", "answered").limit(1);
      if (done && done.length > 0) return json({ error: "already_helped" }, 409);

      const { data: todayRows } = await admin
        .from("help_requests").select("kind, status, helper_id")
        .eq("asker_id", userId).gte("created_at", cairoDayStartIso());
      const blocked = createBlockedReason(kind, quotaFrom(todayRows ?? []));
      if (blocked) return json({ error: blocked }, 429);

      // الأصدقاء الأونلاين اللي حلّوا اللغز يوصلهم الطلب كلهم الأول،
      // ولو أقل من 5 بنكمّل من غير الأصدقاء لحد 5.
      const { data: friends, error: fErr } = await admin.rpc("help_eligible_helpers", {
        p_asker: userId, p_riddle: idx, p_limit: MAX_FRIENDS_NOTIFIED, p_mode: "friends", p_kind: kind,
      });
      if (fErr) return json({ error: "Lookup failed" }, 500);
      const friendIds = (friends ?? []).map((h: { user_id: string }) => h.user_id);
      let otherIds: string[] = [];
      if (friendIds.length < MAX_NOTIFIED) {
        const { data: others, error: oErr } = await admin.rpc("help_eligible_helpers", {
          p_asker: userId, p_riddle: idx, p_limit: MAX_NOTIFIED - friendIds.length, p_mode: "others", p_kind: kind,
        });
        if (oErr) return json({ error: "Lookup failed" }, 500);
        otherIds = (others ?? []).map((h: { user_id: string }) => h.user_id);
      }
      const ids = [...friendIds, ...otherIds];
      if (ids.length === 0) return json({ error: "no_helpers" }, 409);

      // الفرصة التانية من غير إعلان بتتستهلك هنا.
      const sinceIso = new Date(Date.now() - FREE_RETRY_WINDOW_MS).toISOString();
      await admin.from("help_requests").update({ retry_used: true })
        .eq("asker_id", userId).eq("riddle_index", idx)
        .eq("kind", kind)
        .eq("status", "expired").eq("retry_used", false).gte("created_at", sinceIso);

      const expiresAt = new Date(Date.now() + REQUEST_TTL_MS).toISOString();
      const { data: row, error: iErr } = await admin
        .from("help_requests")
        .insert({
          asker_id: userId, riddle_index: idx, notified_ids: ids, expires_at: expiresAt,
          kind,
          talk_seconds: kind === "voice" ? talkSecondsFor(prof.help_pass_tier, prof.help_pass_until) : 0,
        })
        .select("id, session_key, expires_at").single();
      if (iErr || !row) return json({ error: "Create failed" }, 500);

      return json({
        id: row.id, sessionKey: row.session_key, status: "open",
        expiresAt: row.expires_at, notified: ids.length, kind,
      }, 200);
    }

    // ---------- قبول الطلب ----------
    if (action === "accept") {
      const id = asUuid(b.id);
      if (!id) return json({ error: "Invalid id" }, 400);
      await expireStale(admin);

      const { data: busy } = await admin
        .from("help_requests").select("id")
        .eq("helper_id", userId).eq("status", "accepted").limit(1);
      if (busy && busy.length > 0) return json({ error: "busy" }, 409);

      const nowIso = new Date().toISOString();

      // لو حصل حظر بين الطرفين بعد وصول الطلب: ما ينفعش يتقبل.
      const { data: pre0 } = await admin
        .from("help_requests").select("asker_id").eq("id", id).maybeSingle();
      if (pre0?.asker_id) {
        const { data: b1 } = await admin
          .from("blocked_users").select("blocker_id")
          .eq("blocker_id", userId).eq("blocked_id", pre0.asker_id).limit(1);
        const { data: b2 } = await admin
          .from("blocked_users").select("blocker_id")
          .eq("blocker_id", pre0.asker_id).eq("blocked_id", userId).limit(1);
        const blk = [...(b1 ?? []), ...(b2 ?? [])];
        if (blk && blk.length > 0) return json({ error: "taken_or_expired" }, 409);
      }
      const { data: pre } = await admin
        .from("help_requests").select("talk_seconds, kind").eq("id", id).maybeSingle();
      const talk = Math.min(TALK_MAX_S, Math.max(0, Number(pre?.talk_seconds ?? 60)));
      const sessionEnds = new Date(Date.now() + Math.max(SESSION_TTL_MS, (talk + PICK_GRACE_S) * 1000)).toISOString();
      const { data: rows, error } = await admin
        .from("help_requests")
        .update({ status: "accepted", helper_id: userId, accepted_at: nowIso, expires_at: sessionEnds })
        .eq("id", id).eq("status", "open").gt("expires_at", nowIso)
        .contains("notified_ids", [userId])
        .select("id, asker_id, riddle_index, session_key, expires_at");
      if (error) return json({ error: "Accept failed" }, 500);
      if (!rows || rows.length === 0) return json({ error: "taken_or_expired" }, 409);
      const r = rows[0];
      const kind = normalizeKind(pre?.kind);

      // لو المساعد كان جاوب اللغز غلط: السيرفر يعرف (من نتيجته المحفوظة) ويحفظ اختياره الغلط.
      const { data: hs } = await admin
        .from("riddle_starts").select("result, selected_option")
        .eq("user_id", userId).eq("riddle_index", r.riddle_index).maybeSingle();
      const wrong = kind === "voice"
        ? helperWrongInfo(hs?.result, hs?.selected_option)
        : { wasWrong: false, wrongOption: null as string | null };
      if (wrong.wasWrong) {
        await admin.from("help_requests")
          .update({ helper_was_wrong: true, helper_wrong_option: wrong.wrongOption })
          .eq("id", r.id);
      }

      // لغز اللاعب اللي بيطلب المساعدة يتعلّم "بمساعدة" (بيدخل المنافسة عادي، والمالك يشوف العلامة).
      await admin.from("riddle_starts")
        .update({ assisted: true, assisted_by: userId })
        .eq("user_id", r.asker_id).eq("riddle_index", r.riddle_index).is("answered_at", null);

      // لو المساعد كان في نص لغزه: بيرجّع له من الأول بساعة جديدة، بس اللغز ده مش بيدخل ترتيب السرعة.
      const { data: hp } = await admin
        .from("profiles").select("last_puzzle_index").eq("user_id", userId).maybeSingle();
      await admin.from("riddle_starts")
        .update({ unranked: true, pending_restart: true })
        .eq("user_id", userId).eq("riddle_index", hp?.last_puzzle_index ?? 0).is("answered_at", null);

      const people = await profilesFor(admin, [r.asker_id]);
      return json({
        id: r.id,
        riddleIndex: r.riddle_index,
        sessionKey: r.session_key,
        expiresAt: r.expires_at,
        talkSeconds: talk,
        kind,
        wasWrong: wrong.wasWrong,
        wrongOption: wrong.wrongOption,
        asker: { id: r.asker_id, ...(people.get(r.asker_id) ?? { username: displayName(null, r.asker_id), avatarUrl: null }) },
      }, 200);
    }

    // ---------- المساعد بيبعت اختياره ----------
    if (action === "pick") {
      const id = asUuid(b.id);
      if (!id) return json({ error: "Invalid id" }, 400);
      if (typeof b.option !== "string") return json({ error: "Invalid option" }, 400);

      const { data: reqRow } = await admin
        .from("help_requests")
        .select("id, asker_id, helper_id, riddle_index, status, accepted_at, expires_at, helper_was_wrong, helper_wrong_option")
        .eq("id", id).maybeSingle();
      if (!reqRow || reqRow.helper_id !== userId) return json({ error: "Not found" }, 404);
      if (reqRow.status !== "accepted") return json({ error: reqRow.status }, 409);
      if (Date.parse(reqRow.expires_at) < Date.now()) {
        await admin.from("help_requests").update({ status: "expired" }).eq("id", id).eq("status", "accepted");
        return json({ error: "expired" }, 410);
      }

      const elapsedMs = Date.now() - Date.parse(reqRow.accepted_at);
      const reward = helperReward(b.option, ANSWERS[reqRow.riddle_index], elapsedMs);
      if (!reward.selected) return json({ error: "Invalid option" }, 400);

      // المساعد اللي عرف إنه جاوب غلط مينفعش يرشّح نفس الإجابة الغلط تاني.
      if (reqRow.helper_was_wrong && isSameOption(reward.selected, reqRow.helper_wrong_option)) {
        return json({ error: "same_as_wrong" }, 400);
      }

      let points = pointsForHelper(!!reqRow.helper_was_wrong, reward.points);
      if (points > 0) {
        const dayStart = cairoDayStartIso();
        const { count: todayHelps } = await admin
          .from("help_requests").select("id", { count: "exact", head: true })
          .eq("helper_id", userId).eq("status", "answered").gt("helper_points", 0)
          .gte("answered_at", dayStart);
        if ((todayHelps ?? 0) >= DAILY_HELP_CAP) points = 0;
        else {
          const { data: pair } = await admin
            .from("help_requests").select("id")
            .eq("helper_id", userId).eq("asker_id", reqRow.asker_id)
            .eq("status", "answered").gt("helper_points", 0)
            .gte("answered_at", dayStart).limit(1);
          if (pair && pair.length > 0) points = 0;
        }
      }

      const { data: upd, error: uErr } = await admin
        .from("help_requests")
        .update({
          status: "answered",
          answered_at: new Date().toISOString(),
          hint_text: reward.selected,
          helper_correct: reward.correct,
          helper_points: points,
        })
        .eq("id", id).eq("status", "accepted").eq("helper_id", userId)
        .select("id");
      if (uErr) return json({ error: "Save failed" }, 500);
      if (!upd || upd.length === 0) return json({ error: "conflict" }, 409);

      if (points > 0) {
        const { error: pErr } = await admin.rpc("help_add_points", { p_user: userId, p_points: points });
        if (pErr) console.error("help_add_points failed", pErr);
      }
      return json({
        correct: reward.correct, points,
        capped: !reqRow.helper_was_wrong && reward.points > 0 && points === 0,
      }, 200);
    }

    // ---------- متابعة الطلب ----------
    if (action === "status") {
      const id = asUuid(b.id);
      if (!id) return json({ error: "Invalid id" }, 400);
      await expireStale(admin);

      const { data: r } = await admin
        .from("help_requests")
        .select("id, asker_id, helper_id, riddle_index, status, session_key, expires_at, hint_text, helper_points, helper_correct, accepted_at, talk_seconds, talk_extended, kind, voice_started_at, helper_was_wrong, helper_wrong_option")
        .eq("id", id).maybeSingle();
      if (!r) return json({ error: "Not found" }, 404);

      const isAsker = r.asker_id === userId;
      const isHelper = r.helper_id === userId;
      if (!isAsker && !isHelper) return json({ error: "Not found" }, 404);

      const otherId = isAsker ? r.helper_id : r.asker_id;
      const people = otherId ? await profilesFor(admin, [otherId]) : new Map();
      const other = otherId
        ? { id: otherId, ...(people.get(otherId) ?? { username: displayName(null, otherId), avatarUrl: null }) }
        : null;

      const kind = normalizeKind(r.kind);
      // النسخة الجديدة من التطبيق (v=2) بتحسب الوقت من لحظة بداية الصوت؛ القديمة من وقت القبول.
      const tl = talkTimeline(r.voice_started_at, r.talk_seconds);
      const talkLeftNow = b.v === 2
        ? (r.status === "accepted" ? tl.talkLeft : 0)
        : (r.status === "accepted" && r.accepted_at
          ? Math.max(0, Math.ceil((Date.parse(r.accepted_at) + r.talk_seconds * 1000 - Date.now()) / 1000))
          : 0);
      return json({
        kind,
        voiceStarted: tl.started,
        wasWrong: isHelper ? !!r.helper_was_wrong : undefined,
        wrongOption: isHelper && r.helper_was_wrong ? r.helper_wrong_option : undefined,
        hintWrongOption: isAsker && r.status === "answered" && r.helper_was_wrong ? r.helper_wrong_option : null,
        role: isAsker ? "asker" : "helper",
        status: r.status,
        riddleIndex: r.riddle_index,
        expiresAt: r.expires_at,
        sessionKey: r.session_key,
        other,
        talkSeconds: r.talk_seconds,
        talkLeft: talkLeftNow,
        canExtend: isAsker && kind === "voice" && r.status === "accepted" && tl.started
          && !r.talk_extended && r.talk_seconds < TALK_MAX_S,
        hintText: isAsker && r.status === "answered" ? r.hint_text : null,
        helperPoints: isHelper ? r.helper_points : undefined,
      }, 200);
    }

    // ---------- طلب صداقة من جوه جلسة المساعدة ----------
    if (action === "friend_request") {
      const id = asUuid(b.id);
      if (!id) return json({ error: "Invalid id" }, 400);
      const { data: r } = await admin
        .from("help_requests").select("asker_id, helper_id, status").eq("id", id).maybeSingle();
      if (!r || (r.asker_id !== userId && r.helper_id !== userId)) return json({ error: "Not found" }, 404);
      if (r.status !== "accepted" && r.status !== "answered") return json({ error: "not_in_session" }, 409);
      const other = r.asker_id === userId ? r.helper_id : r.asker_id;
      if (!other) return json({ error: "not_in_session" }, 409);

      const { data: b1 } = await admin.from("blocked_users").select("blocker_id")
        .eq("blocker_id", userId).eq("blocked_id", other).limit(1);
      const { data: b2 } = await admin.from("blocked_users").select("blocker_id")
        .eq("blocker_id", other).eq("blocked_id", userId).limit(1);
      if ((b1 ?? []).length + (b2 ?? []).length > 0) return json({ error: "blocked" }, 409);

      const { data: fr } = await admin.from("friends").select("user_id")
        .eq("user_id", userId).eq("friend_id", other).limit(1);
      if (fr && fr.length > 0) return json({ status: "already_friends" }, 200);

      // لو التاني كان بعتلي طلب قبل كده: نقبله على طول.
      const { data: theirs } = await admin.from("friend_requests").select("id")
        .eq("from_user", other).eq("to_user", userId).eq("status", "pending").limit(1);
      if (theirs && theirs.length > 0) {
        await makeFriends(admin, theirs[0].id, other, userId);
        return json({ status: "already_friends" }, 200);
      }

      const { data: mine } = await admin.from("friend_requests").select("id")
        .eq("from_user", userId).eq("to_user", other).eq("status", "pending").limit(1);
      if (mine && mine.length > 0) return json({ status: "sent" }, 200);

      const { count: today } = await admin
        .from("friend_requests").select("id", { count: "exact", head: true })
        .eq("from_user", userId).gte("created_at", cairoDayStartIso());
      if ((today ?? 0) >= DAILY_FRIEND_REQUEST_CAP) return json({ error: "daily_limit" }, 429);

      // لو فيه طلب قديم مرفوض/ملغي بين الاتنين بنحدّثه بدل ما نصطدم بـ UNIQUE.
      const { data: old } = await admin.from("friend_requests").select("id")
        .eq("from_user", userId).eq("to_user", other).limit(1);
      if (old && old.length > 0) {
        await admin.from("friend_requests")
          .update({ status: "pending", responded_at: null, created_at: new Date().toISOString() })
          .eq("id", old[0].id);
      } else {
        const { error: insErr } = await admin.from("friend_requests")
          .insert({ from_user: userId, to_user: other, status: "pending" });
        if (insErr) return json({ error: "Create failed" }, 500);
      }
      return json({ status: "sent" }, 200);
    }

    // ---------- الرد على طلب صداقة ----------
    if (action === "friend_respond") {
      const rid = asUuid(b.request_id);
      if (!rid) return json({ error: "Invalid id" }, 400);
      const accept = b.accept === true;
      const { data: fr } = await admin.from("friend_requests")
        .select("id, from_user, to_user, status").eq("id", rid).maybeSingle();
      if (!fr || fr.to_user !== userId) return json({ error: "Not found" }, 404);
      if (fr.status !== "pending") return json({ ok: true }, 200);
      if (accept) await makeFriends(admin, fr.id, fr.from_user, fr.to_user);
      else await admin.from("friend_requests").update({ status: "rejected" }).eq("id", fr.id);
      return json({ ok: true, accepted: accept }, 200);
    }

    // ---------- إضافة دقيقة للصوت (الطالب بعد مشاهدة إعلان مكافأة) ----------
    if (action === "extend") {
      const id = asUuid(b.id);
      if (!id) return json({ error: "Invalid id" }, 400);
      const { data: r } = await admin
        .from("help_requests")
        .select("id, asker_id, status, talk_seconds, talk_extended, expires_at, accepted_at, kind, voice_started_at")
        .eq("id", id).maybeSingle();
      if (!r || r.asker_id !== userId) return json({ error: "Not found" }, 404);
      if (normalizeKind(r.kind) !== "voice" || !r.voice_started_at
        || r.status !== "accepted" || r.talk_extended || r.talk_seconds >= TALK_MAX_S) {
        return json({ error: "cannot_extend" }, 409);
      }
      const newTalk = Math.min(TALK_MAX_S, r.talk_seconds + 60);
      const newEnds = new Date(Date.parse(r.expires_at) + (newTalk - r.talk_seconds) * 1000).toISOString();
      const { data: upd } = await admin
        .from("help_requests")
        .update({ talk_seconds: newTalk, talk_extended: true, expires_at: newEnds })
        .eq("id", id).eq("status", "accepted").eq("talk_seconds", r.talk_seconds)
        .select("id");
      if (!upd || upd.length === 0) return json({ error: "cannot_extend" }, 409);
      return json({ ok: true, talkSeconds: newTalk }, 200);
    }

    // ---------- الصوت اتوصل عند الطرف ده (العدّاد بيبدأ لما الاتنين يبلّغوا) ----------
    if (action === "voice_ready") {
      const id = asUuid(b.id);
      if (!id) return json({ error: "Invalid id" }, 400);
      const { data: r } = await admin
        .from("help_requests")
        .select("id, asker_id, helper_id, status, kind, talk_seconds, expires_at, voice_started_at, asker_voice_ready, helper_voice_ready")
        .eq("id", id).maybeSingle();
      if (!r || (r.asker_id !== userId && r.helper_id !== userId)) return json({ error: "Not found" }, 404);
      if (r.status !== "accepted" || normalizeKind(r.kind) !== "voice") return json({ error: "not_in_session" }, 409);
      if (r.voice_started_at) return json({ started: true, startedAt: r.voice_started_at }, 200);

      const isAsker = r.asker_id === userId;
      const askerReady = isAsker ? true : !!r.asker_voice_ready;
      const helperReady = isAsker ? !!r.helper_voice_ready : true;
      await admin.from("help_requests")
        .update(isAsker ? { asker_voice_ready: true } : { helper_voice_ready: true })
        .eq("id", id).eq("status", "accepted");

      if (!(askerReady && helperReady)) return json({ started: false }, 200);

      // الاتنين جاهزين: نسجّل بداية الصوت مرة واحدة (أول واحد ينجح بس) ونمدّد مهلة الجلسة.
      const startedMs = Date.now();
      const { data: upd } = await admin
        .from("help_requests")
        .update({
          voice_started_at: new Date(startedMs).toISOString(),
          expires_at: sessionEndAfterVoiceStart(r.expires_at, startedMs, r.talk_seconds),
        })
        .eq("id", id).eq("status", "accepted").is("voice_started_at", null)
        .select("voice_started_at");
      if (upd && upd.length > 0) return json({ started: true, startedAt: upd[0].voice_started_at }, 200);
      const { data: again } = await admin
        .from("help_requests").select("voice_started_at").eq("id", id).maybeSingle();
      return json({ started: !!again?.voice_started_at, startedAt: again?.voice_started_at ?? null }, 200);
    }

    // ---------- إلغاء ----------
    if (action === "cancel") {
      const id = asUuid(b.id);
      if (!id) return json({ error: "Invalid id" }, 400);

      const { data: r } = await admin
        .from("help_requests").select("id, asker_id, helper_id, status").eq("id", id).maybeSingle();
      if (!r || (r.asker_id !== userId && r.helper_id !== userId)) return json({ error: "Not found" }, 404);
      if (r.status !== "open" && r.status !== "accepted") return json({ ok: true }, 200);

      // لو المساعد هو اللي انسحب، اللاعب ياخد فرصة تانية من غير إعلان.
      const next = r.helper_id === userId ? "expired" : "cancelled";
      await admin.from("help_requests").update({ status: next })
        .eq("id", id).in("status", ["open", "accepted"]);
      return json({ ok: true }, 200);
    }

    return json({ error: "Invalid action" }, 400);
  } catch (e) {
    console.error("help-request error", e);
    return json({ error: "Internal error" }, 500);
  }
});

// بنقبل الطلب ونكتب الصداقة في الاتجاهين بنفسنا (من غير الاعتماد على تريجرات الدردشة).
// deno-lint-ignore no-explicit-any
async function makeFriends(admin: any, requestId: string, a: string, b: string) {
  await admin.from("friend_requests")
    .update({ status: "accepted", responded_at: new Date().toISOString() }).eq("id", requestId);
  await admin.from("friends").upsert(
    [{ user_id: a, friend_id: b }, { user_id: b, friend_id: a }],
    { onConflict: "user_id,friend_id", ignoreDuplicates: true },
  );
}

type Row = { id: string; asker_id: string; riddle_index: number; expires_at: string; kind?: string | null };

// الطلبات اللي مهلتها خلصت تتقفل (بتتنفذ مع أي نداء — مفيش مهمة مجدولة).
// deno-lint-ignore no-explicit-any
async function expireStale(admin: any) {
  await admin.from("help_requests")
    .update({ status: "expired" })
    .in("status", ["open", "accepted"])
    .lt("expires_at", new Date().toISOString());
}

// الاسم المستعار والصورة (من الـ view العام) — مش الاسم الحقيقي.
// deno-lint-ignore no-explicit-any
async function profilesFor(admin: any, ids: string[]) {
  const out = new Map<string, { username: string; avatarUrl: string | null }>();
  const unique = [...new Set(ids)];
  if (unique.length === 0) return out;
  const { data } = await admin
    .from("public_profiles").select("user_id, username, avatar_url").in("user_id", unique);
  for (const p of data ?? []) {
    out.set(p.user_id, { username: displayName(p.username, p.user_id), avatarUrl: p.avatar_url ?? null });
  }
  for (const id of unique) {
    if (!out.has(id)) out.set(id, { username: displayName(null, id), avatarUrl: null });
  }
  return out;
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
