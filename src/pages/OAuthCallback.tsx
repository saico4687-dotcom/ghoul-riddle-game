import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const OAuthCallback = () => {
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    const handleCallback = async () => {
      try {
        // 🔥 مهم: نخلي Supabase يلتقط session من URL
        const { error } = await supabase.auth.getSession();

        if (error) {
          console.error("OAuth session error:", error);
        }

        // ⏳ ندي وقت بسيط للتأكد إن session اتسجل
        await new Promise((r) => setTimeout(r, 500));

      } catch (e) {
        console.error("OAuth callback error:", e);
      }

      if (!cancelled) {
        // 🔥 بعد النجاح نرجع للهوم
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
      <div className="text
