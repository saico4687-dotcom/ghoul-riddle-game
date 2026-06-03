import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { clearStaleAuth } from "@/lib/clearStaleAuth";

declare global {
  interface Window {
    median?: any;
  }
}

/**
 * تسجيل دخول جوجل:
 * - داخل تطبيق Median: يستخدم Native Google Login ثم يمرر التوكن لـ Supabase
 * - في المتصفح العادي: يستخدم OAuth العادي عبر Lovable Cloud
 */
export function googleLogin(redirectPath: string = "/"): Promise<void> {
  return new Promise(async (resolve, reject) => {
    // Wipe any stale/broken session before attempting a fresh login
    await clearStaleAuth();
    const median = typeof window !== "undefined" ? window.median : undefined;

    if (median && median.socialLogin && median.socialLogin.google) {
      median.socialLogin.google.login({
        callback: async (response: any) => {
          try {
            console.log("Google Login Response:", response);
            if (response && (response.idToken || response.token)) {
              const { error } = await supabase.auth.signInWithIdToken({
                provider: "google",
                token: response.idToken || response.token,
              });
              if (error) {
                console.error("Supabase signIn error:", error);
                reject(error);
                return;
              }
              window.location.href = redirectPath;
              resolve();
            } else {
              reject(new Error("لم يتم استلام توكن من Google"));
            }
          } catch (err) {
            console.error("Native Google login failed:", err);
            reject(err);
          }
        },
      });
      return;
    }

    // متصفح عادي → OAuth العادي
    lovable.auth
      .signInWithOAuth("google", { redirect_uri: window.location.origin })
      .then((result: any) => {
        if (result?.error) {
          reject(result.error);
          return;
        }
        resolve();
      })
      .catch(reject);
  });
}
