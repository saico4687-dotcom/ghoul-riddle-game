import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

/**
 * Catches any stray OAuth landings (e.g. /auth/callback or /~oauth/callback
 * that for some reason weren't intercepted by the Lovable proxy). Waits for
 * the SDK to finish processing the URL fragment, then bounces home.
 */
const OAuthCallback = () => {
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Give the SDK a tick to consume the URL fragment
      await new Promise((r) => setTimeout(r, 300));
      try {
        await supabase.auth.getSession();
      } catch {
        /* ignore */
      }
      if (!cancelled) navigate("/", { replace: true });
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return (
    <div
      dir="rtl"
      className="min-h-screen flex items-center justify-center bg-background text-foreground font-typewriter"
    >
      <div className="text-center">
        <div className="w-10 h-10 mx-auto mb-4 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p>جارٍ إكمال تسجيل الدخول…</p>
      </div>
    </div>
  );
};

export default OAuthCallback;
