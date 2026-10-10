import { supabase } from "@/integrations/supabase/client";

// واجهة التطبيق لدالة السيرفر help-request ("استعين بصديق").
// كل القرارات (مين مؤهل، النقاط، التصحيح) على السيرفر.

export type HelpPerson = { id?: string; username: string; avatarUrl: string | null };

export type HelpStatus = "open" | "accepted" | "answered" | "expired" | "cancelled";

// نوع الطلب: voice = صوت بإعلان (5 يوميًا)، hint = تلميح بدون صوت (باقي الـ 20).
export type HelpKind = "voice" | "hint";

export type HelpApiError = { status: number | null; code: string };
// ملاحظة: النوع مش union عشان tsconfig غير صارم (strictNullChecks مقفول) والتضييق مبيشتغلش.
export type HelpResult<T> = { ok: boolean; data: T; error: HelpApiError };

async function readError(error: unknown): Promise<HelpApiError> {
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

async function call<T>(body: Record<string, unknown>): Promise<HelpResult<T>> {
  try {
    const { data, error } = await supabase.functions.invoke("help-request", { body });
    if (error) return { ok: false, data: null as unknown as T, error: await readError(error) };
    return { ok: true, data: data as T, error: { status: null, code: "" } };
  } catch (e) {
    return { ok: false, data: null as unknown as T, error: { status: null, code: String((e as Error)?.message ?? e) } };
  }
}

export const helpApi = {
  settings: () => call<{ available: boolean }>({ action: "settings" }),
  setAvailable: (available: boolean) => call<{ available: boolean }>({ action: "set_available", available }),

  inbox: () =>
    call<{
      pending: { id: string; riddleIndex: number; kind: HelpKind; secondsLeft: number; asker: HelpPerson }[];
      active: { id: string; riddleIndex: number; kind: HelpKind } | null;
      friendRequests: { id: string; from: HelpPerson }[];
      friendAccepted?: { id: string; friend: HelpPerson; entranceNo: number }[];
    }>({ action: "inbox" }),

  // تأكيد إن إشعار قبول الصداقة (دخلة المصارع) اتعرض.
  ackFriendAccept: (ids: string[]) => call<{ ok: true }>({ action: "ack_friend_accept", ids }),

  availability: (riddleIndex: number) =>
    call<{
      count: number;
      voiceCount: number;
      hintCount: number;
      voiceLeft: number;
      hintLeft: number;
      hintAdNeeded: boolean;
      freeRetry: boolean;
      freeRetryVoice: boolean;
      freeRetryHint: boolean;
      limitReached: boolean;
    }>({
      action: "availability",
      riddle_index: riddleIndex,
    }),

  create: (riddleIndex: number, kind: HelpKind) =>
    call<{ id: string; sessionKey: string; status: HelpStatus; expiresAt: string; resumed?: boolean; kind: HelpKind }>({
      action: "create",
      riddle_index: riddleIndex,
      kind,
    }),

  accept: (id: string) =>
    call<{
      id: string;
      riddleIndex: number;
      sessionKey: string;
      expiresAt: string;
      talkSeconds: number;
      kind: HelpKind;
      wasWrong: boolean;
      wrongOption: string | null;
      asker: HelpPerson;
    }>({
      action: "accept",
      id,
    }),

  pick: (id: string, option: string) =>
    call<{ correct: boolean; points: number; capped: boolean }>({ action: "pick", id, option }),

  status: (id: string) =>
    call<{
      kind: HelpKind;
      voiceStarted: boolean;
      wasWrong?: boolean;
      wrongOption?: string | null;
      hintWrongOption: string | null;
      role: "asker" | "helper";
      status: HelpStatus;
      riddleIndex: number;
      expiresAt: string;
      sessionKey: string;
      other: HelpPerson | null;
      hintText: string | null;
      helperPoints?: number;
      talkSeconds: number;
      talkLeft: number;
      canExtend: boolean;
    }>({ action: "status", id, v: 2 }),

  // الصوت اتوصل عندي: السيرفر بيبدأ عدّاد الصوت لما الاتنين يبلّغوا.
  voiceReady: (id: string) =>
    call<{ started: boolean; startedAt?: string | null }>({ action: "voice_ready", id }),

  extend: (id: string) => call<{ ok: true; talkSeconds: number }>({ action: "extend", id }),

  friendRequest: (id: string) =>
    call<{ status: "sent" | "already_friends" }>({ action: "friend_request", id }),

  friendRespond: (requestId: string, accept: boolean) =>
    call<{ ok: true; accepted?: boolean }>({ action: "friend_respond", request_id: requestId, accept }),

  cancel: (id: string) => call<{ ok: true }>({ action: "cancel", id }),
};

// رسالة بالعربي لكل كود خطأ.
export function helpErrorMessage(code: string): string {
  switch (code) {
    case "no_helpers":
      return "مفيش مساعد متاح دلوقتي، جرّب بعد شوية 🙏";
    case "daily_limit":
      return "وصلت للحد الأقصى من طلبات المساعدة النهارده.";
    case "voice_limit":
      return "خلّصت طلبات الصوت النهارده (5). جرّب التلميح من غير صوت 💡";
    case "hint_limit":
      return "خلّصت التلميحات النهارده.";
    case "same_as_wrong":
      return "ده اختيارك الغلط، اختار إجابة تانية.";
    case "already_helped":
      return "اتساعدت في اللغز ده قبل كده.";
    case "out_of_order":
    case "not_started":
      return "استنى لحد ما اللغز يبدأ وجرّب تاني.";
    case "taken_or_expired":
      return "الطلب اتقبل من شخص تاني أو خلص وقته.";
    case "blocked":
      return "مش ممكن إضافة الشخص ده.";
    case "not_in_session":
      return "تقدر تضيف صديق أثناء الجلسة أو بعدها مباشرة.";
    case "cannot_extend":
      return "مفيش إضافة وقت متاحة دلوقتي.";
    case "busy":
      return "إنت بتساعد حد دلوقتي.";
    default:
      return "حصلت مشكلة في الاتصال، جرّب تاني.";
  }
}

// علامة بسيطة: اللاعب نفسه بيطلب مساعدة دلوقتي — بنمنع ظهور طلبات مساعدة وارد عليه وقتها.
export const helpRuntime = { askerActive: false };

// حدث بيبعته الإعدادات لما اللاعب يغيّر "أنا متاح للمساعدة".
export const HELP_AVAILABILITY_EVENT = "help-availability-changed";
// علامة بتخلّي الصفحة الرئيسية تفتح اللغز على طول بعد ما المساعد يخلّص.
export const RESUME_PLAY_KEY = "rabh_resume_play_v1";

// علامة: التحدي بدأ من صفحة لغز (بعد النهاية نرجع للغز).
export const FROM_RIDDLE_KEY = "arena_from_riddle_v1";
