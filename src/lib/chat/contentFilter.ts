// Lightweight client-side profanity filter + rate limiter for chat messages.
// Server-side moderation triggers (auto_moderate_on_report, is_active_user, RLS) remain source of truth.

const AR_BAD = ["كسم", "شرموط", "خول", "زانية", "منيوك", "قحبة", "طيز"];
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
