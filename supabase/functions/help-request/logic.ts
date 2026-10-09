// منطق نقي (من غير اتصال بقاعدة بيانات) لميزة "استعين بصديق" عشان نقدر نختبره.
import { isAnswerCorrect, scoreFor } from "../submit-answer/logic.ts";

export const REQUEST_TTL_MS = 60_000; // مهلة قبول الطلب
export const SESSION_TTL_MS = 120_000; // مهلة المساعد من لحظة الموافقة لحد ما يبعت الإجابة
export const MAX_NOTIFIED = 5; // عدد المساعدين اللي يوصلهم الطلب
export const MAX_FRIENDS_NOTIFIED = 20; // أقصى عدد أصدقاء يوصلهم الطلب
export const DAILY_FRIEND_REQUEST_CAP = 20; // أقصى طلبات صداقة يوميًا من جوه المساعدة
export const DAILY_ASK_CAP = 20; // أقصى عدد طلبات يوميًا للاعب
export const DAILY_HELP_CAP = 10; // أقصى عدد مساعدات بتتحسب نقط يوميًا للمساعد
export const FREE_RETRY_WINDOW_MS = 10 * 60_000; // لو محدش قبل: فرصة تانية من غير إعلان خلال 10 دقايق

// مدة الصوت بعد قبول المساعد: 60 ثانية افتراضيًا، 120 لصاحب باقة "دقيقتين" أو بعد إضافة دقيقة بإعلان.
export const TALK_BASE_S = 60;
export const TALK_MAX_S = 120;
export const PICK_GRACE_S = 60; // وقت إضافي للمساعد يبعت اختياره بعد انتهاء الصوت

// باقة "خط النجدة" (tier 1 = دقيقة، tier 2 = دقيقتين) سارية لحد help_pass_until.
export function talkSecondsFor(tier: unknown, until: unknown, nowMs: number = Date.now()): number {
  const t = Number(tier);
  const u = typeof until === "string" ? Date.parse(until) : NaN;
  const active = Number.isFinite(u) && u > nowMs;
  return active && t === 2 ? TALK_MAX_S : TALK_BASE_S;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function asUuid(v: unknown): string | null {
  return typeof v === "string" && UUID_RE.test(v) ? v.toLowerCase() : null;
}

// الاسم اللي بيظهر للاعب التاني: الاسم المستعار، وإلا "لاعب" + أول 4 حروف من المعرّف.
// (مش بنعرض الاسم الحقيقي المسجّل لاستلام الجائزة.)
export function displayName(username: string | null | undefined, userId: string): string {
  const u = (username ?? "").trim();
  return u || `لاعب ${userId.replace(/-/g, "").slice(0, 4)}`;
}

// نقاط المساعد: لو اختياره صح بياخد نقاط اللغز (10) + بونص السرعة من لحظة الموافقة.
export function helperReward(option: unknown, correctAnswer: string, elapsedMs: number) {
  const selected = typeof option === "string" ? option.trim().slice(0, 500) : null;
  const clean = selected && selected.length > 0 ? selected : null;
  const correct = isAnswerCorrect(clean, correctAnswer);
  const { pointsEarned, bonusEarned } = scoreFor(correct, Math.max(0, elapsedMs));
  return { selected: clean, correct, points: pointsEarned, bonus: bonusEarned };
}

// بداية اليوم بتوقيت القاهرة (بالـ UTC ISO) — بيتحسب منها الحد اليومي.
export function cairoDayStartIso(now: Date = new Date()): string {
  const local = (tz: string) => new Date(now.toLocaleString("en-US", { timeZone: tz })).getTime();
  const offsetMs = local("Africa/Cairo") - local("UTC");
  const cairoNow = now.getTime() + offsetMs;
  const dayStartCairo = Math.floor(cairoNow / 86_400_000) * 86_400_000;
  return new Date(dayStartCairo - offsetMs).toISOString();
}

// ---------- النسخة 2: نوع الطلب (صوت / تلميح) والحصص اليومية ----------
export type HelpKind = "voice" | "hint";

export const DAILY_VOICE_CAP = 5; // طلبات صوت بإعلان في اليوم
export const DAILY_HINT_CAP = DAILY_ASK_CAP - DAILY_VOICE_CAP; // باقي الـ 20: تلميح بدون صوت (15)
export const HINT_PACK_SIZE = 5; // إعلان مكافأة واحد لكل 5 تلميحات

export function normalizeKind(v: unknown): HelpKind {
  return v === "hint" ? "hint" : "voice";
}

export type AskRow = { kind?: string | null; status?: string | null; helper_id?: string | null };

// الطلب اللي محدش قبله (انتهى/اتلغى من غير مساعد) مبيتحسبش من حصة النوع (بس بيتحسب من حد الـ 20 الكلي).
function counted(r: AskRow): boolean {
  return !!r.helper_id || r.status === "open";
}

export function quotaFrom(rows: AskRow[]) {
  const voiceUsed = rows.filter((r) => normalizeKind(r.kind) === "voice" && counted(r)).length;
  const hintUsed = rows.filter((r) => normalizeKind(r.kind) === "hint" && counted(r)).length;
  const total = rows.length;
  const totalLeft = Math.max(0, DAILY_ASK_CAP - total);
  return {
    total,
    voiceUsed,
    hintUsed,
    voiceLeft: Math.min(Math.max(0, DAILY_VOICE_CAP - voiceUsed), totalLeft),
    hintLeft: Math.min(Math.max(0, DAILY_HINT_CAP - hintUsed), totalLeft),
    // أول تلميح في كل باقة من 5 محتاج إعلان.
    hintAdNeeded: hintUsed % HINT_PACK_SIZE === 0,
  };
}

export function createBlockedReason(kind: HelpKind, q: ReturnType<typeof quotaFrom>): string | null {
  if (q.total >= DAILY_ASK_CAP) return "daily_limit";
  if (kind === "voice" && q.voiceLeft <= 0) return "voice_limit";
  if (kind === "hint" && q.hintLeft <= 0) return "hint_limit";
  return null;
}

// عدّاد الصوت: بيبدأ من لحظة ما الطرفين يتوصلوا (voice_started_at)، مش من وقت القبول.
export function talkTimeline(
  voiceStartedAt: string | null | undefined,
  talkSeconds: number,
  nowMs: number = Date.now(),
) {
  const started = typeof voiceStartedAt === "string" && Number.isFinite(Date.parse(voiceStartedAt));
  if (!started) return { started: false, talkLeft: Math.max(0, talkSeconds) };
  const left = Math.ceil((Date.parse(voiceStartedAt as string) + talkSeconds * 1000 - nowMs) / 1000);
  return { started: true, talkLeft: Math.max(0, Math.min(talkSeconds, left)) };
}

// امتداد مهلة الجلسة لما الصوت يبدأ: وقت الصوت + مهلة إرسال الاختيار.
export function sessionEndAfterVoiceStart(
  currentExpiresIso: string,
  startedMs: number,
  talkSeconds: number,
): string {
  const need = startedMs + (talkSeconds + PICK_GRACE_S) * 1000;
  return new Date(Math.max(Date.parse(currentExpiresIso), need)).toISOString();
}

const norm = (s: unknown) => (typeof s === "string" ? s.normalize("NFC").trim() : "");

// المساعد اللي جاوب غلط: بنحدد من نتيجة لغزه المحفوظة على السيرفر (مش من كلامه).
export function helperWrongInfo(
  result: unknown,
  selectedOption: unknown,
): { wasWrong: boolean; wrongOption: string | null } {
  const r = result as { isCorrect?: unknown } | null | undefined;
  if (!r || r.isCorrect !== false) return { wasWrong: false, wrongOption: null };
  const o = norm(selectedOption);
  return { wasWrong: true, wrongOption: o ? o.slice(0, 500) : null };
}

export function isSameOption(a: unknown, b: unknown): boolean {
  const x = norm(a);
  return x.length > 0 && x === norm(b);
}

// المساعد اللي كان غلط مياخدش نقاط حتى لو خمّن صح دلوقتي.
export function pointsForHelper(wasWrong: boolean, points: number): number {
  return wasWrong ? 0 : points;
}
