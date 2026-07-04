import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { heartbeatPresence } from "@/lib/chat/queries";
import { useAuth } from "./useAuth";

export function usePresence() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const beat = () => {
      heartbeatPresence().catch(() => {});
    };

    const markOffline = async () => {
      try {
        await supabase
          .from("user_presence")
          .upsert(
            { user_id: user.id, status: "offline", last_seen_at: new Date().toISOString() },
            { onConflict: "user_id" }
          );
      } catch {}
    };

    beat();
    const heartbeat = window.setInterval(beat, 30_000);

    const onVis = () => {
      if (document.visibilityState === "hidden") markOffline();
      else beat();
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pagehide", markOffline);
    window.addEventListener("beforeunload", markOffline);

    return () => {
      window.clearInterval(heartbeat);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pagehide", markOffline);
      window.removeEventListener("beforeunload", markOffline);
      markOffline();
    };
  }, [user]);
}
