import { supabase } from "@/integrations/supabase/client";

/**
 * Makes sure we have a valid, non-expired Supabase auth session before
 * performing a write that depends on auth.uid() (creating a group, saving
 * profile settings, uploading an avatar, etc.).
 *
 * Inside the Android WebView (Capacitor) the JS timer that normally
 * auto-refreshes the access token can fail to fire while the app is
 * backgrounded, which can leave the client holding an expired token even
 * though the UI still looks "logged in". Sending a request with an expired
 * token makes auth.uid() resolve to null on the server, which then fails
 * RLS checks with a confusing "new row violates row-level security policy"
 * error instead of a clear "please log in again" message.
 *
 * Call this right before any such write. If it returns false, stop and tell
 * the user their session expired instead of letting the request go through.
 *
 * ملاحظة: أول ما التطبيق يرجع من الخلفية بعد فترة، أول نداء لـ
 * getSession()/refreshSession() ممكن يفشل بسبب لحظة اتصال الشبكة (مش لأن
 * الجلسة فعلاً انتهت)، فده كان بيسبب رسالة "انتهت الجلسة" غلط حتى لو
 * اليوزر لسه مسجل دخول فعلاً. عشان كده بنعمل محاولة واحدة إضافية (retry)
 * قبل ما نرجع false نهائياً.
 */
export async function ensureFreshSession(): Promise<boolean> {
  try {
    const { data, error } = await supabase.auth.getSession();

    // مفيش session خالص في الذاكرة/التخزين المحلي — ده مختلف عن "قربت
    // تنتهي"، بس برضه ممكن يكون مؤقت (مشكلة قراءة من التخزين لحظة إفاقة
    // التطبيق) فبنجرب refreshSession() قبل ما نستسلم، لأنه بيقرا الـ
    // refresh token من التخزين مباشرة وممكن ينجح حتى لو getSession() فشل.
    if (error || !data.session) {
      const first = await supabase.auth.refreshSession();
      if (!first.error && first.data.session) return true;

      await new Promise((r) => setTimeout(r, 700));
      const second = await supabase.auth.refreshSession();
      return !second.error && !!second.data.session;
    }

    const session = data.session;
    const expiresAtMs = session.expires_at ? session.expires_at * 1000 : 0;
    const isExpiringSoon = !expiresAtMs || expiresAtMs - Date.now() < 60_000;

    if (!isExpiringSoon) return true;

    const refreshed = await supabase.auth.refreshSession();
    if (!refreshed.error && refreshed.data.session) return true;

    // ريتراي مرة واحدة بس — أحياناً أول محاولة refresh بتفشل بسبب مشكلة
    // شبكة لحظية جداً، مش لأن الـ refresh token فعلاً باظ.
    await new Promise((r) => setTimeout(r, 700));
    const retry = await supabase.auth.refreshSession();
    return !retry.error && !!retry.data.session;
  } catch {
    return false;
  }
}

export const SESSION_EXPIRED_MESSAGE = "انتهت صلاحية جلستك، برجاء تسجيل الدخول مرة أخرى.";
