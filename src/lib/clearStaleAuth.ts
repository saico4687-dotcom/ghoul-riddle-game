import { supabase } from "@/integrations/supabase/client";

/**
 * Clears any stale Supabase auth tokens from localStorage and signs out locally.
 * Use BEFORE attempting a fresh login to avoid "refresh_token_not_found" / 403
 * errors that can leave the auth client in a broken state.
 */
export async function clearStaleAuth() {
  try {
    await supabase.auth.signOut({ scope: "local" });
  } catch {
    // ignore – we force-clear storage next
  }
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith("sb-") || k.includes("supabase"))
      .forEach((k) => localStorage.removeItem(k));
  } catch {
    // ignore
  }
}
