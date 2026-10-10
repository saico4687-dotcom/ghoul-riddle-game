// منطق التحدي النقي (من غير قاعدة بيانات) عشان نقدر نختبره.

export type GameKey = "speed" | "one_shot" | "memory" | "pressure" | "moving" | "turns";

export interface GameDef {
  key: GameKey;
  windowMs: number; // مدة الإجابة لكل لاعب
  revealDelayMs: number; // مدة عرض السؤال قبل ما الاختيارات تظهر (الذاكرة القصيرة)
  sequential: boolean; // الدور بالدور
}

export const COUNTDOWN_MS = 6000; // عدّ تنازلي قبل بداية اللعب
export const GRACE_MS = 3000; // سماحية الشبكة
export const OPEN_TTL_MS = 45_000; // مهلة رد الخصم
export const DAILY_CHALLENGE_CAP = 20; // تحديات يبدأها اللاعب في اليوم (الكل)
export const DAILY_VOICE_CAP = 5; // منهم بالصوت (والباقي بدون صوت)
export const DAILY_ACCEPT_CAP = 10; // تحديات يقبلها اللاعب في اليوم

export const GAMES: Record<GameKey, GameDef> = {
  speed: { key: "speed", windowMs: 30_000, revealDelayMs: 0, sequential: false },
  one_shot: { key: "one_shot", windowMs: 15_000, revealDelayMs: 0, sequential: false },
  memory: { key: "memory", windowMs: 20_000, revealDelayMs: 6000, sequential: false },
  pressure: { key: "pressure", windowMs: 12_000, revealDelayMs: 0, sequential: false },
  moving: { key: "moving", windowMs: 30_000, revealDelayMs: 0, sequential: false },
  turns: { key: "turns", windowMs: 20_000, revealDelayMs: 0, sequential: true },
};

export function asGame(v: unknown): GameDef | null {
  return typeof v === "string" && Object.prototype.hasOwnProperty.call(GAMES, v) ? GAMES[v as GameKey] : null;
}

export function cleanRingName(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.normalize("NFC").replace(/[\u0000-\u001f<>]/g, "").replace(/\s+/g, " ").trim();
  if (s.length < 2 || s.length > 20) return null;
  return s;
}

// وقت بداية اللعب الفعلي (بعد العدّ التنازلي، ومعاه مدة عرض السؤال في الذاكرة القصيرة).
export function playBaseMs(g: GameDef, startsAtMs: number): number {
  return startsAtMs + g.revealDelayMs;
}

// نهاية اللعبة الكاملة (بعدها بتتقفل لو حد ما جاوبش).
export function gameEndsAtMs(g: GameDef, startsAtMs: number): number {
  const base = playBaseMs(g, startsAtMs);
  return base + g.windowMs * (g.sequential ? 2 : 1) + GRACE_MS;
}

export interface Side {
  correct: boolean;
  answered: boolean;
  ms: number; // زمن الإجابة (بيتجاهل لو مش مجاوب)
}

export type Winner = "challenger" | "opponent" | "draw";

// القرار النهائي. a = المتحدّي، b = الخصم.
export function decide(game: GameKey, a: Side, b: Side): Winner {
  const ac = a.answered && a.correct;
  const bc = b.answered && b.correct;
  if (ac && !bc) return "challenger";
  if (bc && !ac) return "opponent";
  if (!ac && !bc) return "draw";
  // الاتنين صح
  if (game === "one_shot") return "draw";
  if (game === "turns") return "challenger"; // اللي جاوب الأول وخاطر
  if (a.ms < b.ms) return "challenger";
  if (b.ms < a.ms) return "opponent";
  return "draw";
}
