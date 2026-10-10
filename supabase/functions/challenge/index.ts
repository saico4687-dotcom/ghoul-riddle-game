import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { ANSWERS } from "../submit-answer/answers.ts";
import { isAnswerCorrect } from "../submit-answer/logic.ts";
import {
  asGame,
  cleanRingName,
  COUNTDOWN_MS,
  DAILY_ACCEPT_CAP,
  DAILY_CHALLENGE_CAP,
  DAILY_VOICE_CAP,
  decide,
  GAMES,
  gameEndsAtMs,
  GRACE_MS,
  OPEN_TTL_MS,
  playBaseMs,
  type GameKey,
} from "./logic.ts";

// "التحدي" (الحلبة) — كل حاجة من السيرفر:
//  me      : اسم الحلبة + المتبقي من التحديات النهارده.
//  sign    : التوقيع (اسم الحلبة + الموافقة).
//  create  : المتحدّي بيختار لعبة؛ السيرفر بيختار صديق متاح عشوائي واللغز.
//  inbox   : تحدي واصل ليّا / تحدي شغال (للرجوع له).
//  respond : الخصم بيقبل أو يرفض.
//  status  : متابعة التحدي (بيقفل لوحده لما الوقت يخلص).
//  answer  : الإجابة (الزمن بساعة السيرفر والصح بيتحسب هنا؛ الإجابة الصحيحة مبتتبعتش لأي حد).
//  cancel  : المتحدّي بيلغي قبل ما الخصم يرد.
// التحدي مستقل عن جايزة الأسبوع: من غير نقاط ومن غير ترتيب.
// أي لغز اتلعب في تحدي: اللي ماجاوبوش قبل كده بيتعلّم عنده "unranked" (بيتشال من الترتيب).

const TOTAL_RIDDLES = ANSWERS.length;
const ENTRANCES = 10;
const asEntrance = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isInteger(n) && n >= 1 && n <= ENTRANCES ? n : null;
};

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

    const myProfile = async () => {
      const { data } = await admin
        .from("profiles")
        .select("user_id, ring_name, ring_signed_at, last_puzzle_index")
        .eq("user_id", userId)
        .maybeSingle();
      return data as { ring_name: string | null; ring_signed_at: string | null; last_puzzle_index: number | null } | null;
    };

    const countToday = async (col: "challenger_id" | "opponent_id", voiceOnly = false) => {
      let q = admin
        .from("challenges")
        .select("id", { count: "exact", head: true })
        .eq(col, userId);
      if (voiceOnly) q = q.eq("voice", true);
      const { count } = await q
        .in("status", ["playing", "finished"])
        .gte("created_at", cairoDayStartIso());
      return count ?? 0;
    };

    // ---------- me ----------
    if (action === "me") {
      const p = await myProfile();
      const used = await countToday("challenger_id");
      return json({
        ringName: p?.ring_name ?? null,
        signed: !!p?.ring_signed_at && !!p?.ring_name,
        createLeft: Math.max(0, DAILY_CHALLENGE_CAP - used),
        voiceLeft: Math.max(0, DAILY_VOICE_CAP - (await countToday("challenger_id", true))),
      }, 200);
    }

    // ---------- sign ----------
    if (action === "sign") {
      const name = cleanRingName(b.ring_name);
      if (!name) return json({ error: "bad_ring_name" }, 400);
      if (b.agree !== true) return json({ error: "need_agree" }, 400);
      const { error } = await admin
        .from("profiles")
        .update({ ring_name: name, ring_signed_at: new Date().toISOString() })
        .eq("user_id", userId);
      if (error) return json({ error: "save_failed" }, 500);
      return json({ ringName: name }, 200);
    }

    await expireOld(admin);

    // ---------- create ----------
    if (action === "create") {
      const g = asGame(b.game);
      if (!g) return json({ error: "bad_game" }, 400);
      const entrance = asEntrance(b.entrance);
      if (!entrance) return json({ error: "bad_entrance" }, 400);
      const p = await myProfile();
      if (!p || !p.ring_signed_at || !p.ring_name) return json({ error: "need_sign" }, 403);
      if ((await countToday("challenger_id")) >= DAILY_CHALLENGE_CAP) return json({ error: "daily_cap" }, 429);

      const voice = b.voice === true;
      if (voice && (await countToday("challenger_id", true)) >= DAILY_VOICE_CAP) return json({ error: "voice_cap" }, 429);

      const mine = await activeFor(admin, userId);
      if (mine) return json({ error: "already_active", id: mine.id }, 409);

      // تحدي من صفحة اللغز: لازم يكون لغزه الحالي ولسه ماجاوبوش.
      let fixedRiddle: number | null = null;
      if (b.riddle_index !== undefined && b.riddle_index !== null) {
        const n = Number(b.riddle_index);
        if (!Number.isInteger(n) || n < 0 || n >= TOTAL_RIDDLES) return json({ error: "bad_riddle" }, 400);
        if (n !== (p.last_puzzle_index ?? 0)) return json({ error: "bad_riddle" }, 409);
        const { data: rs } = await admin.from("riddle_starts").select("answered_at").eq("user_id", userId).eq("riddle_index", n).maybeSingle();
        if (rs?.answered_at) return json({ error: "already_answered" }, 409);
        fixedRiddle = n;
      }

      const { data: cand, error: cErr } = await admin.rpc("challenge_candidates", { p_user: userId, p_limit: 1 });
      if (cErr) return json({ error: "lookup_failed" }, 500);
      const oppId = (cand ?? [])[0]?.user_id as string | undefined;
      if (!oppId) return json({ error: "no_friend" }, 404);

      const riddleIndex = fixedRiddle ?? (await pickRiddle(admin, userId, oppId));
      const { data: row, error: iErr } = await admin
        .from("challenges")
        .insert({
          challenger_id: userId,
          opponent_id: oppId,
          riddle_index: riddleIndex,
          game: g.key,
          challenger_entrance: entrance,
          voice,
          from_riddle: fixedRiddle !== null,
          expires_at: new Date(Date.now() + OPEN_TTL_MS).toISOString(),
        })
        .select("id")
        .single();
      if (iErr || !row) return json({ error: "create_failed" }, 500);
      return json({ id: row.id }, 200);
    }

    // ---------- inbox ----------
    if (action === "inbox") {
      const nowIso = new Date().toISOString();
      const { data: open } = await admin
        .from("challenges")
        .select("id, challenger_id, game, expires_at, challenger_entrance, voice")
        .eq("opponent_id", userId)
        .eq("status", "open")
        .gt("expires_at", nowIso)
        .order("created_at", { ascending: false })
        .limit(1);
      const { data: playing } = await admin
        .from("challenges")
        .select("id, ends_at")
        .or(`challenger_id.eq.${userId},opponent_id.eq.${userId}`)
        .eq("status", "playing")
        .gt("ends_at", nowIso)
        .limit(1);
      let pending = null;
      if (open && open.length > 0) {
        const c = open[0];
        const { data: ch } = await admin.from("profiles").select("ring_name").eq("user_id", c.challenger_id).maybeSingle();
        const people = await profilesFor(admin, [c.challenger_id]);
        pending = {
          id: c.id,
          game: c.game,
          challengerEntrance: c.challenger_entrance,
          voice: !!c.voice,
          secondsLeft: Math.max(0, Math.ceil((Date.parse(c.expires_at) - Date.now()) / 1000)),
          challenger: { ...people.get(c.challenger_id), ringName: ch?.ring_name ?? null },
        };
      }
      return json({ pending, active: playing && playing.length > 0 ? { id: playing[0].id } : null }, 200);
    }

    // باقي الأفعال بتخص تحدي معيّن.
    const id = typeof b.id === "string" ? b.id : "";
    if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: "bad_id" }, 400);
    const { data: c0 } = await admin.from("challenges").select("*").eq("id", id).maybeSingle();
    if (!c0 || (c0.challenger_id !== userId && c0.opponent_id !== userId)) return json({ error: "not_found" }, 404);
    const role: "challenger" | "opponent" = c0.challenger_id === userId ? "challenger" : "opponent";

    // ---------- respond ----------
    if (action === "respond") {
      if (role !== "opponent") return json({ error: "forbidden" }, 403);
      if (c0.status !== "open" || Date.parse(c0.expires_at) <= Date.now()) return json({ error: "gone" }, 410);
      if (b.accept !== true) {
        await admin.from("challenges").update({ status: "declined" }).eq("id", id).eq("status", "open");
        return json({ ok: true }, 200);
      }
      const entrance = asEntrance(b.entrance);
      if (!entrance) return json({ error: "bad_entrance" }, 400);
      if (entrance === c0.challenger_entrance) return json({ error: "same_entrance" }, 409);
      const p = await myProfile();
      let ring = p?.ring_name ?? null;
      if (!p?.ring_signed_at || !ring) {
        const name = cleanRingName(b.ring_name);
        if (!name || b.agree !== true) return json({ error: "need_sign" }, 403);
        ring = name;
        await admin.from("profiles").update({ ring_name: name, ring_signed_at: new Date().toISOString() }).eq("user_id", userId);
      }
      if ((await countToday("opponent_id")) >= DAILY_ACCEPT_CAP) return json({ error: "daily_cap" }, 429);
      const mine = await activeFor(admin, userId, id);
      if (mine) return json({ error: "already_active", id: mine.id }, 409);

      const g = GAMES[c0.game as GameKey];
      const now = Date.now();
      const startsAt = now + COUNTDOWN_MS;
      const { data: upd } = await admin
        .from("challenges")
        .update({
          status: "playing",
          opponent_entrance: entrance,
          accepted_at: new Date(now).toISOString(),
          starts_at: new Date(startsAt).toISOString(),
          ends_at: new Date(gameEndsAtMs(g, startsAt)).toISOString(),
        })
        .eq("id", id)
        .eq("status", "open")
        .gt("expires_at", new Date(now).toISOString())
        .select("id");
      if (!upd || upd.length === 0) return json({ error: "gone" }, 410);

      // اللغز اتشاف: اللي ماجاوبوش قبل كده بيتشال من الترتيب عنده.
      await markSeen(admin, c0.challenger_id, c0.riddle_index);
      await markSeen(admin, c0.opponent_id, c0.riddle_index);
      return json({ id }, 200);
    }

    // ---------- cancel ----------
    if (action === "cancel") {
      if (role !== "challenger") return json({ error: "forbidden" }, 403);
      await admin.from("challenges").update({ status: "cancelled" }).eq("id", id).eq("status", "open");
      return json({ ok: true }, 200);
    }

    // ---------- answer ----------
    if (action === "answer") {
      const c = await settle(admin, c0);
      if (c.status !== "playing") return json({ error: "over", ...(await view(admin, c, role)) }, 409);
      const g = GAMES[c.game as GameKey];
      const startsAt = Date.parse(c.starts_at);
      const base = playBaseMs(g, startsAt);
      const now = Date.now();
      const done = role === "challenger" ? c.challenger_done : c.opponent_done;
      if (done) return json({ error: "already_answered" }, 409);
      if (now < base) return json({ error: "too_early" }, 425);

      let myBase = base;
      if (g.sequential && role === "opponent") {
        if (!c.challenger_done) return json({ error: "not_your_turn" }, 409);
        myBase = c.challenger_at ? Date.parse(c.challenger_at) : base + g.windowMs;
      }
      if (now > myBase + g.windowMs + GRACE_MS) return json({ error: "too_late" }, 410);

      const raw = b.option;
      const option = typeof raw === "string" && raw.trim() ? raw.slice(0, 500) : null;
      if (!option) return json({ error: "bad_option" }, 400);
      const ms = Math.max(0, now - myBase);
      const patch = role === "challenger"
        ? { challenger_option: option, challenger_at: new Date(now).toISOString(), challenger_ms: ms, challenger_done: true }
        : { opponent_option: option, opponent_at: new Date(now).toISOString(), opponent_ms: ms, opponent_done: true };
      const col = role === "challenger" ? "challenger_done" : "opponent_done";
      const { data: upd } = await admin.from("challenges").update(patch).eq("id", id).eq("status", "playing").eq(col, false).select("id");
      if (!upd || upd.length === 0) return json({ error: "already_answered" }, 409);
      const { data: fresh } = await admin.from("challenges").select("*").eq("id", id).single();
      const c2 = await settle(admin, fresh);
      return json(await view(admin, c2, role), 200);
    }

    // ---------- status ----------
    if (action === "status") {
      const c = await settle(admin, c0);
      return json(await view(admin, c, role), 200);
    }

    return json({ error: "Invalid action" }, 400);
  } catch (e) {
    console.error("challenge error", e);
    return json({ error: "Internal error" }, 500);
  }
});

function json(data: unknown, status: number) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function cairoDayStartIso(): string {
  const now = new Date();
  const cairo = new Date(now.toLocaleString("en-US", { timeZone: "Africa/Cairo" }));
  const diff = now.getTime() - cairo.getTime();
  cairo.setHours(0, 0, 0, 0);
  return new Date(cairo.getTime() + diff).toISOString();
}

// deno-lint-ignore no-explicit-any
async function expireOld(admin: any) {
  await admin.from("challenges").update({ status: "expired" }).eq("status", "open").lt("expires_at", new Date().toISOString());
}

// تحدي شغال للاعب (مفتوح لسه أو بيتلعب).
// deno-lint-ignore no-explicit-any
async function activeFor(admin: any, userId: string, exceptId?: string) {
  const nowIso = new Date().toISOString();
  const { data } = await admin
    .from("challenges")
    .select("id, status, expires_at, ends_at")
    .or(`challenger_id.eq.${userId},opponent_id.eq.${userId}`)
    .in("status", ["open", "playing"]);
  for (const c of data ?? []) {
    if (exceptId && c.id === exceptId) continue;
    if (c.status === "open" && c.expires_at > nowIso) return c;
    if (c.status === "playing" && c.ends_at && c.ends_at > nowIso) return c;
  }
  return null;
}

// لغز عشوائي محدش من الاتنين جاوبه قبل كده (ولو مفيش، أي لغز).
// deno-lint-ignore no-explicit-any
async function pickRiddle(admin: any, a: string, bId: string): Promise<number> {
  const [{ data: profs }, { data: rows }] = await Promise.all([
    admin.from("profiles").select("user_id, last_puzzle_index").in("user_id", [a, bId]),
    admin.from("riddle_starts").select("riddle_index").in("user_id", [a, bId]).not("answered_at", "is", null),
  ]);
  const progress = Math.max(0, ...(profs ?? []).map((p: { last_puzzle_index: number | null }) => p.last_puzzle_index ?? 0));
  const answered = new Set<number>((rows ?? []).map((r: { riddle_index: number }) => r.riddle_index));
  const fresh: number[] = [];
  for (let i = progress; i < TOTAL_RIDDLES; i++) if (!answered.has(i)) fresh.push(i);
  const pool = fresh.length > 0 ? fresh : Array.from({ length: TOTAL_RIDDLES }, (_, i) => i);
  return pool[Math.floor(Math.random() * pool.length)];
}

// اللغز اتشاف في التحدي: لو اللاعب ماجاوبوش قبل كده، بيتشال من الترتيب عنده
// (نفس آلية مساعد "استعين بصديق": unranked + الساعة بتبدأ من جديد لما يوصله).
// deno-lint-ignore no-explicit-any
async function markSeen(admin: any, userId: string, idx: number) {
  const { data: prof } = await admin.from("profiles").select("last_puzzle_index").eq("user_id", userId).maybeSingle();
  if (idx < (prof?.last_puzzle_index ?? 0)) return; // عدّى عليه قبل كده
  const { data: row } = await admin
    .from("riddle_starts")
    .select("answered_at")
    .eq("user_id", userId)
    .eq("riddle_index", idx)
    .maybeSingle();
  if (row?.answered_at) return;
  if (row) {
    await admin.from("riddle_starts").update({ unranked: true, pending_restart: true })
      .eq("user_id", userId).eq("riddle_index", idx).is("answered_at", null);
  } else {
    await admin.from("riddle_starts").upsert(
      { user_id: userId, riddle_index: idx, unranked: true, pending_restart: true },
      { onConflict: "user_id,riddle_index", ignoreDuplicates: true },
    );
  }
}

// يقفل اللاعبين اللي وقتهم خلص، ولو الاتنين خلصوا (أو الوقت كله خلص) يحسم النتيجة.
// deno-lint-ignore no-explicit-any
async function settle(admin: any, c: any) {
  if (c.status !== "playing" || !c.starts_at) return c;
  const g = GAMES[c.game as GameKey];
  const now = Date.now();
  const startsAt = Date.parse(c.starts_at);
  const base = playBaseMs(g, startsAt);
  const patch: Record<string, unknown> = {};
  let chDone = c.challenger_done;
  let opDone = c.opponent_done;

  if (g.sequential) {
    if (!chDone && now > base + g.windowMs + GRACE_MS) { patch.challenger_done = true; chDone = true; }
    if (chDone && !opDone) {
      const ob = c.challenger_at ? Date.parse(c.challenger_at) : base + g.windowMs;
      if (now > ob + g.windowMs + GRACE_MS) { patch.opponent_done = true; opDone = true; }
    }
  } else if (now > base + g.windowMs + GRACE_MS) {
    if (!chDone) { patch.challenger_done = true; chDone = true; }
    if (!opDone) { patch.opponent_done = true; opDone = true; }
  }

  if (chDone && opDone) {
    const idx = c.riddle_index as number;
    const aOpt = c.challenger_option as string | null;
    const bOpt = c.opponent_option as string | null;
    const aCorrect = aOpt !== null && isAnswerCorrect(aOpt, ANSWERS[idx]);
    const bCorrect = bOpt !== null && isAnswerCorrect(bOpt, ANSWERS[idx]);
    const winner = decide(
      g.key,
      { correct: aCorrect, answered: aOpt !== null, ms: c.challenger_ms ?? Infinity },
      { correct: bCorrect, answered: bOpt !== null, ms: c.opponent_ms ?? Infinity },
    );
    Object.assign(patch, {
      status: "finished",
      challenger_correct: aCorrect,
      opponent_correct: bCorrect,
      winner,
      finished_at: new Date(now).toISOString(),
    });
  }
  if (Object.keys(patch).length === 0) return c;
  await admin.from("challenges").update(patch).eq("id", c.id).eq("status", "playing");
  const { data } = await admin.from("challenges").select("*").eq("id", c.id).single();
  return data ?? c;
}

// شكل الرد للاعب: مفيش إجابة صحيحة بتتبعت أبدًا.
// deno-lint-ignore no-explicit-any
async function view(admin: any, c: any, role: "challenger" | "opponent") {
  const otherId = role === "challenger" ? c.opponent_id : c.challenger_id;
  const people = await profilesFor(admin, [otherId]);
  const { data: rings } = await admin.from("profiles").select("user_id, ring_name").in("user_id", [c.challenger_id, c.opponent_id]);
  const ringOf = (uid: string) => (rings ?? []).find((r: { user_id: string }) => r.user_id === uid)?.ring_name ?? null;
  const g = GAMES[c.game as GameKey];
  const startsAt = c.starts_at ? Date.parse(c.starts_at) : null;
  const base = startsAt !== null ? playBaseMs(g, startsAt) : null;
  const meDone = role === "challenger" ? c.challenger_done : c.opponent_done;
  const otherDone = role === "challenger" ? c.opponent_done : c.challenger_done;

  // الدور بالدور: دور اللاعب الأول، وبعدين التاني بيشوف اختيار الأول (من غير ما نقوله صح ولا غلط).
  let myBase = base;
  let canAnswer = c.status === "playing" && !meDone;
  if (g.sequential && base !== null) {
    if (role === "opponent") {
      canAnswer = canAnswer && c.challenger_done;
      myBase = c.challenger_at ? Date.parse(c.challenger_at) : base + g.windowMs;
    }
  }
  const out: Record<string, unknown> = {
    v: 1,
    id: c.id,
    role,
    status: c.status,
    game: c.game,
    riddleIndex: c.riddle_index,
    voice: !!c.voice,
    fromRiddle: !!c.from_riddle,
    sessionKey: c.session_key,
    ringSelf: ringOf(userOf(c, role)),
    ringOther: ringOf(otherId),
    entranceSelf: role === "challenger" ? c.challenger_entrance : c.opponent_entrance,
    entranceOther: role === "challenger" ? c.opponent_entrance : c.challenger_entrance,
    other: people.get(otherId) ?? null,
    serverNow: Date.now(),
    startsAt,
    revealAt: base,
    myBase,
    windowMs: g.windowMs,
    endsAt: c.ends_at ? Date.parse(c.ends_at) : null,
    meDone,
    otherDone,
    canAnswer,
    sequential: g.sequential,
    expiresAt: Date.parse(c.expires_at),
  };
  if (g.sequential && role === "opponent" && c.challenger_done) out.challengerPick = c.challenger_option ?? null;
  if (c.status === "finished") {
    const me = role === "challenger";
    out.result = {
      winner: c.winner === "draw" ? "draw" : (c.winner === role ? "me" : "other"),
      meCorrect: me ? c.challenger_correct : c.opponent_correct,
      otherCorrect: me ? c.opponent_correct : c.challenger_correct,
      meMs: me ? c.challenger_ms : c.opponent_ms,
      otherMs: me ? c.opponent_ms : c.challenger_ms,
    };
  }
  return out;
}

function userOf(c: { challenger_id: string; opponent_id: string }, role: "challenger" | "opponent") {
  return role === "challenger" ? c.challenger_id : c.opponent_id;
}

// الاسم المستعار والصورة (من الـ view العام) — مش الاسم الحقيقي.
// deno-lint-ignore no-explicit-any
async function profilesFor(admin: any, ids: string[]) {
  const out = new Map<string, { username: string; avatarUrl: string | null }>();
  const unique = [...new Set(ids)];
  if (unique.length === 0) return out;
  const { data } = await admin.from("public_profiles").select("user_id, username, avatar_url").in("user_id", unique);
  for (const p of data ?? []) {
    const u = (p.username ?? "").trim();
    out.set(p.user_id, { username: u || `لاعب ${String(p.user_id).replace(/-/g, "").slice(0, 4)}`, avatarUrl: p.avatar_url ?? null });
  }
  for (const id of unique) {
    if (!out.has(id)) out.set(id, { username: `لاعب ${id.replace(/-/g, "").slice(0, 4)}`, avatarUrl: null });
  }
  return out;
}
