import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export function usePresence() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const upsert = async (status: "online" | "offline") => {
      try {
        await supabase
          .from("user_presence")
          .upsert(
            { user_id: user.id, status, last_seen_at: new Date().toISOString() },
            { onConflict: "user_id" }
          );
        await supabase
          .from("profiles")
          .update({ last_seen_at: new Date().toISOString() })
          .eq("user_id", user.id);
      } catch {}
    };

    upsert("online");
    const heartbeat = setInterval(() => upsert("online"), 30_000);

    const onVis = () => {
      if (document.visibilityState === "hidden") upsert("offline");
      else upsert("online");
    };
    const onUnload = () => upsert("offline");

    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pagehide", onUnload);
    window.addEventListener("beforeunload", onUnload);

    return () => {
      clearInterval(heartbeat);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pagehide", onUnload);
      window.removeEventListener("beforeunload", onUnload);
      upsert("offline");
    };
  }, [user]);
}
