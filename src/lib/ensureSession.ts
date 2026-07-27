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
 */
export async function ensureFreshSession(): Promise<boolean> {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session) return false;

    const session = data.session;
    const expiresAtMs = session.expires_at ? session.expires_at * 1000 : 0;
    const isExpiringSoon = !expiresAtMs || expiresAtMs - Date.now() < 60_000;

    if (isExpiringSoon) {
      const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError || !refreshed.session) return false;
    }

    return true;
  } catch {
    return false;
  }
}

export const SESSION_EXPIRED_MESSAGE = "انتهت صلاحية جلستك، برجاء تسجيل الدخول مرة أخرى.";
