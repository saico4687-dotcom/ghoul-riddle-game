import { supabase } from "@/integrations/supabase/client";

// نتيجة تصحيح السيرفر. مفيهاش الإجابة الصحيحة أبدًا — الشرح بيجي بس لو الإجابة صح.
export interface ServerAnswerResult {
  isCorrect: boolean;
  reactionNo?: number; // رقم صوت الرد (1..5) اللي السيرفر اختاره
  explanation: string | null;
  elapsedMs: number;
  pointsEarned: number;
  bonusEarned: number;
  score: number;
  totalPoints: number;
  timeBonus: number;
  nextIndex: number;
  finished: boolean;
  milestoneReached: 100 | 200 | null;
}

export type SubmitOutcome =
  | { status: "ok"; result: ServerAnswerResult }
  // اللغز اتسجّل قبل كده (والرد الأول ضاع): مفيش نتيجة نعرضها.
  | { status: "conflict" }
  // مشكلة اتصال أو سيرفر حتى بعد إعادة المحاولة.
  | { status: "error" };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function readError(error: unknown): Promise<{ status: number | null; message: string }> {
  const e = error as { context?: Response; message?: string };
  const status = typeof e?.context?.status === "number" ? e.context.status : null;
  let message = e?.message ?? "";
  try {
    const body = await e?.context?.clone().json();
    if (body?.error) message = String(body.error);
  } catch {
    /* تجاهل */
  }
  return { status, message };
}

async function invoke(body: Record<string, unknown>) {
  return supabase.functions.invoke("submit-answer", { body });
}

// بتسجّل بداية اللغز بساعة السيرفر (بعد انتهاء كتابة السؤال). بتحاول 3 مرات.
export async function startRiddleOnServer(riddleIndex: number): Promise<boolean> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const { data, error } = await invoke({ action: "start", riddle_index: riddleIndex });
      if (!error) return !!(data as { ok?: boolean } | null)?.ok;
      const { status } = await readError(error);
      if (status !== null && status >= 400 && status < 500) return false; // رفض نهائي
    } catch (e) {
      console.warn("[submit-answer] start error:", e);
    }
    await sleep(700 * (attempt + 1));
  }
  return false;
}

// بتبعت نص الاختيار (مش رقمه) والسيرفر هو اللي يصحّح ويحسب الزمن.
export async function submitAnswerToServer(
  riddleIndex: number,
  selectedOption: string,
): Promise<SubmitOutcome> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const { data, error } = await invoke({
        action: "answer",
        riddle_index: riddleIndex,
        selected_option: selectedOption,
      });
      if (!error) {
        const res = data as ServerAnswerResult | null;
        if (res && typeof res.isCorrect === "boolean") return { status: "ok", result: res };
        return { status: "error" };
      }
      const { status, message } = await readError(error);
      if (status === 409 && /already answered/i.test(message)) return { status: "conflict" };
      const retryable = status === null || status >= 500 || (status === 409 && /in progress/i.test(message));
      if (!retryable) return { status: "error" };
    } catch (e) {
      console.warn("[submit-answer] answer error:", e);
    }
    await sleep(800 * (attempt + 1));
  }
  return { status: "error" };
}

// "حذف إجابتين": السيرفر بيقول أنهي اتنين غلط يتشطبوا (بنصهم). null لو فشل.
export async function fiftyOnServer(riddleIndex: number, options: string[]): Promise<string[] | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { data, error } = await invoke({ action: "fifty", riddle_index: riddleIndex, options });
      if (!error) {
        const remove = (data as { remove?: unknown } | null)?.remove;
        if (Array.isArray(remove) && remove.every((x) => typeof x === "string")) return remove as string[];
        return null;
      }
      const { status } = await readError(error);
      if (status !== null && status >= 400 && status < 500) return null;
    } catch (e) {
      console.warn("[submit-answer] fifty error:", e);
    }
    await sleep(700);
  }
  return null;
}
