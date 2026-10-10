import { supabase } from "@/integrations/supabase/client";

// واجهة التطبيق لدالة السيرفر challenge ("التحدي"). كل القرارات على السيرفر.

// حدث داخلي: عدد التحديات الواصلة (للشارة الحمراء في القايمة).
export const CHALLENGE_PENDING_EVENT = "challenge-pending-changed";

export type GameKey = "speed" | "one_shot" | "memory" | "pressure" | "moving" | "turns";

export type GameInfo = { key: GameKey | string; icon: string; name: string; desc: string; ready: boolean };

// الألعاب الجاهزة + اللي جاية قريب (مقفولة).
export const GAME_LIST: GameInfo[] = [
  { key: "speed", icon: "⚡", name: "نزال السرعة", desc: "أسرع إجابة صح تكسب (30 ث)", ready: true },
  { key: "one_shot", icon: "🎯", name: "ضربة واحدة", desc: "إجابة واحدة بس. لو الاتنين صح = تعادل (15 ث)", ready: true },
  { key: "memory", icon: "🧠", name: "الذاكرة القصيرة", desc: "السؤال بيظهر 6 ثواني وبعدين بيختفي، وبعدها الاختيارات", ready: true },
  { key: "pressure", icon: "⏳", name: "ضغط الوقت", desc: "12 ثانية بس! أسرع صح يكسب", ready: true },
  { key: "moving", icon: "🌀", name: "الحلبة المتحركة", desc: "الاختيارات بتتحرك وتتبدّل مكانها", ready: true },
  { key: "turns", icon: "🔁", name: "الدور بالدور", desc: "انت تجاوب الأول، وخصمك يشوف اختيارك ويقرر", ready: true },
  { key: "trust", icon: "🕵️", name: "ثق أو اكشف", desc: "قريبًا", ready: false },
  { key: "mind", icon: "🔮", name: "قراءة العقل", desc: "قريبًا", ready: false },
  { key: "bet", icon: "🎲", name: "المراهنة بالثقة", desc: "قريبًا", ready: false },
  { key: "whisper", icon: "🤫", name: "جولة الهمس", desc: "قريبًا", ready: false },
];

export const gameName = (k: string) => GAME_LIST.find((g) => g.key === k)?.name ?? k;

export type Person = { username: string; avatarUrl: string | null };

export type ChallengeState = {
  id: string;
  role: "challenger" | "opponent";
  status: "open" | "playing" | "finished" | "declined" | "expired" | "cancelled";
  game: GameKey;
  riddleIndex: number;
  voice: boolean;
  fromRiddle: boolean;
  sessionKey: string;
  ringSelf: string | null;
  ringOther: string | null;
  entranceSelf: number | null;
  entranceOther: number | null;
  other: Person | null;
  serverNow: number;
  startsAt: number | null;
  revealAt: number | null;
  myBase: number | null;
  windowMs: number;
  endsAt: number | null;
  meDone: boolean;
  otherDone: boolean;
  canAnswer: boolean;
  sequential: boolean;
  expiresAt: number;
  challengerPick?: string | null;
  series?: { meWins: number; otherWins: number; draws: number; rounds: number };
  winnerName?: string | null;
  rematch?: { me: boolean | null; other: boolean | null; nextId: string | null; expiresAt: number | null };
  result?: {
    winner: "me" | "other" | "draw";
    meCorrect: boolean | null;
    otherCorrect: boolean | null;
    meMs: number | null;
    otherMs: number | null;
  };
};

export type ApiError = { status: number | null; code: string };
export type Res<T> = { ok: boolean; data: T; error: ApiError };

async function readError(error: unknown): Promise<ApiError> {
  const e = error as { context?: Response; message?: string };
  const status = typeof e?.context?.status === "number" ? e.context.status : null;
  let code = e?.message ?? "";
  try {
    const body = await e?.context?.clone().json();
    if (body?.error) code = String(body.error);
  } catch {
    /* تجاهل */
  }
  return { status, code };
}

async function call<T>(body: Record<string, unknown>): Promise<Res<T>> {
  try {
    const { data, error } = await supabase.functions.invoke("challenge", { body });
    if (error) return { ok: false, data: null as unknown as T, error: await readError(error) };
    return { ok: true, data: data as T, error: { status: null, code: "" } };
  } catch (e) {
    return { ok: false, data: null as unknown as T, error: { status: null, code: String((e as Error)?.message ?? e) } };
  }
}

export const challengeApi = {
  me: () => call<{ ringName: string | null; signed: boolean; createLeft: number; voiceLeft: number }>({ action: "me" }),
  sign: (ringName: string) => call<{ ringName: string }>({ action: "sign", ring_name: ringName, agree: true }),
  create: (game: string, entrance: number, opts?: { riddleIndex?: number; voice?: boolean }) =>
    call<{ id: string }>({ action: "create", game, entrance, riddle_index: opts?.riddleIndex, voice: opts?.voice === true }),
  inbox: () =>
    call<{
      pending: {
        id: string;
        game: string;
        challengerEntrance: number;
        voice: boolean;
        secondsLeft: number;
        challenger: Person & { ringName: string | null };
      } | null;
      active: { id: string } | null;
    }>({ action: "inbox" }),
  respond: (id: string, accept: boolean, opts?: { entrance?: number; ringName?: string }) =>
    call<{ id?: string; ok?: boolean }>({
      action: "respond",
      id,
      accept,
      entrance: opts?.entrance,
      ring_name: opts?.ringName,
      agree: opts?.ringName ? true : undefined,
    }),
  rematch: (id: string, yes: boolean) => call<ChallengeState>({ action: "rematch", id, yes }),
  history: () =>
    call<{
      list: {
        opponentId: string;
        name: string;
        avatarUrl: string | null;
        meWins: number;
        otherWins: number;
        draws: number;
        rounds: number;
        leader: "me" | "other" | "draw";
        leaderName: string | null;
        lastAt: string;
      }[];
    }>({ action: "history" }),
  cancel: (id: string) => call<{ ok: true }>({ action: "cancel", id }),
  status: (id: string) => call<ChallengeState>({ action: "status", id }),
  answer: (id: string, option: string) => call<ChallengeState>({ action: "answer", id, option }),
};

export function challengeError(code: string): string {
  switch (code) {
    case "no_friend":
      return "مفيش صديق متاح دلوقتي. اطلب من أصدقائك يفعّلوا \"أنا متاح للمساعدة\" ويفتحوا التطبيق.";
    case "daily_cap":
      return "وصلت للحد اليومي للتحديات. جرّب بكرة.";
    case "already_active":
      return "عندك تحدي شغال دلوقتي.";
    case "need_sign":
      return "لازم توقّع على التحدي الأول.";
    case "bad_ring_name":
      return "اسم الحلبة لازم يكون من حرفين لـ 20 حرف.";
    case "same_entrance":
      return "خصمك اختار الدخلة دي، اختار دخلة تانية.";
    case "voice_cap":
      return "خلّصت التحديات بالصوت النهارده (5 يوميًا). جرّب تحدي بدون صوت.";
    case "bad_riddle":
    case "already_answered":
      return "التحدي من صفحة اللغز متاح بس للغزك الحالي قبل ما تجاوبه.";
    case "gone":
      return "التحدي انتهى أو اتلغى.";
    default:
      return "حصلت مشكلة، حاول تاني.";
  }
}
