import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const OAuthCallback = () => {
  const navigate = useNavigate();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const goHome = () => {
      if (!cancelled) navigate("/", { replace: true });
    };

    const handleCallback = async () => {
      try {
        const url = new URL(window.location.href);
        const hash = window.location.hash.startsWith("#")
          ? new URLSearchParams(window.location.hash.slice(1))
          : new URLSearchParams();

        const errDesc =
          url.searchParams.get("error_description") ||
          url.searchParams.get("error") ||
          hash.get("error_description") ||
          hash.get("error");
        if (errDesc) {
          console.error("OAuth provider error:", errDesc);
          setErrorMsg(errDesc);
          setTimeout(goHome, 1500);
          return;
        }

        // 1) PKCE flow: ?code=...
        const code = url.searchParams.get("code");
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(
            window.location.href
          );
          if (error) console.error("exchangeCodeForSession error:", error);
          goHome();
          return;
        }

        // 2) Implicit flow: #access_token=...&refresh_token=...
        const accessToken = hash.get("access_token");
        const refreshToken = hash.get("refresh_token");
        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) console.error("setSession error:", error);
          goHome();
          return;
        }

        // 3) Fallback: maybe session already restored
        await supabase.auth.getSession();
        goHome();
      } catch (e) {
        console.error("OAuth callback error:", e);
        goHome();
      }
    };

    handleCallback();

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
        <p>جارٍ إكمال تسجيل الدخول...</p>
      </div>
    </div>
  );
};

export default OAuthCallback;
