// Lightweight client-side profanity filter + rate limiter for chat messages.
// Server-side moderation triggers (auto_moderate_on_report, is_active_user, RLS) remain source of truth.

const AR_BAD = [
  "كسم", "شرموط", "شرموطة", "خول", "زانية", "منيوك", "منيوكة", "قحبة", "طيز",
  "عرص", "متناك", "متناكة", "ابن كلب", "يا كلب", "كس أمك", "كس امك", "يلعن",
  "زبي", "نيك", "ينيك", "متناكه", "عاهرة",
];
const EN_BAD = ["fuck", "shit", "bitch", "asshole", "cunt", "dick", "pussy", "faggot", "nigger"];

const ALL_BAD = [...AR_BAD, ...EN_BAD];

export function filterMessage(input: string): string {
  let out = input;
  for (const w of ALL_BAD) {
    const re = new RegExp(w, "gi");
    out = out.replace(re, "*".repeat(w.length));
  }
  return out;
}

// Sliding-window rate limiter: 10 messages per minute per conversation.
const buckets = new Map<string, number[]>();
const WINDOW_MS = 60_000;
const LIMIT = 10;

export function checkRateLimit(conversationId: string): { ok: boolean; retryInMs: number } {
  const now = Date.now();
  const arr = (buckets.get(conversationId) ?? []).filter((t) => now - t < WINDOW_MS);
  if (arr.length >= LIMIT) {
    const retryInMs = WINDOW_MS - (now - arr[0]);
    return { ok: false, retryInMs };
  }
  arr.push(now);
  buckets.set(conversationId, arr);
  return { ok: true, retryInMs: 0 };
}

// حد "سطر واحد" للرسالة — ممنوع أي سطر جديد (Enter داخل الرسالة)،
// وممنوع تتجاوز عدد الحروف ده حتى لو من غير سطر جديد صريح (زي لصق
// نص طويل جداً). المكالمة دي بتتنفذ في الواجهة قبل الإرسال، ولو
// فشلت لازم يظهر تنبيه للمستخدم ومتتبعتش الرسالة للسيرفر أصلاً.
export const MAX_LINE_CHARS = 120;

export function checkSingleLine(input: string): { ok: boolean; reason?: string } {
  if (/[\r\n]/.test(input)) {
    return { ok: false, reason: "الرسالة لازم تكون سطر واحد بس — من غير أسطر جديدة." };
  }
  if (input.length > MAX_LINE_CHARS) {
    return {
      ok: false,
      reason: `الرسالة طويلة أكتر من سطر واحد — الحد الأقصى ${MAX_LINE_CHARS} حرف.`,
    };
  }
  return { ok: true };
  }
