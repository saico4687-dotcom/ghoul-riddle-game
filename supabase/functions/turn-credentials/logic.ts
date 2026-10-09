// منطق صافي (من غير شبكة) لتجهيز قائمة خوادم ICE — متفصل عشان يتختبر.

export type IceServer = { urls: string | string[]; username?: string; credential?: string };

export const STUN_FALLBACK: IceServer = { urls: "stun:stun.l.google.com:19302" };

/** رد Cloudflare ممكن يبقى iceServers كمصفوفة (generate-ice-servers) أو ككائن واحد (generate). */
export function normalizeCloudflare(raw: unknown): IceServer[] | null {
  const r = raw as { iceServers?: unknown } | null;
  if (!r || typeof r !== "object" || !r.iceServers) return null;
  const list = Array.isArray(r.iceServers) ? r.iceServers : [r.iceServers];
  const out: IceServer[] = [];
  for (const s of list) {
    const o = s as Record<string, unknown>;
    const urls = o?.urls;
    if (typeof urls !== "string" && !Array.isArray(urls)) continue;
    const item: IceServer = { urls: urls as string | string[] };
    if (typeof o.username === "string") item.username = o.username;
    if (typeof o.credential === "string") item.credential = o.credential;
    out.push(item);
  }
  return out.length ? out : null;
}

/** بيانات ثابتة من Supabase Secrets: TURN_URLS (مفصولة بفاصلة) + TURN_USERNAME + TURN_CREDENTIAL. */
export function staticTurn(urlsRaw: string | undefined, username: string | undefined, credential: string | undefined): IceServer[] | null {
  const urls = (urlsRaw ?? "").split(",").map((s) => s.trim()).filter((s) => /^turns?:/i.test(s));
  if (!urls.length || !username || !credential) return null;
  return [{ urls, username, credential }];
}

/** حد بسيط: N طلب في الساعة لكل مستخدم (best-effort داخل نفس الـ isolate). */
export function allow(hits: Map<string, number[]>, userId: string, now: number, max = 30, windowMs = 3_600_000): boolean {
  const arr = (hits.get(userId) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= max) { hits.set(userId, arr); return false; }
  arr.push(now);
  hits.set(userId, arr);
  return true;
}
