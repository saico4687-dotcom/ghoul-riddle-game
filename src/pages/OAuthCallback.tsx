import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const OAuthCallback = () => {
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    const handleCallback = async () => {
      try {
        // ندي Supabase وقت يقرأ الـ URL ويعمل session
        const { error } = await supabase.auth.getSession();

        if (error) {
          console.error("OAuth session error:", error);
        }

        await new Promise((r) => setTimeout(r, 500));
      } catch (e) {
        console.error("OAuth callback error:", e);
      }

      if (!cancelled) {
        navigate("/", { replace: true });
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
