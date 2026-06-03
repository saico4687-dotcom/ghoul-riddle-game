import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        // Validate the session against the server. If the user was deleted,
        // the local refresh token is stale and would break the next login —
        // clear it locally now.
        const { data, error } = await supabase.auth.getUser();
        if (error || !data.user) {
          try { await supabase.auth.signOut({ scope: "local" }); } catch {}
          try {
            Object.keys(localStorage)
              .filter((k) => k.startsWith("sb-") || k.includes("supabase"))
              .forEach((k) => localStorage.removeItem(k));
          } catch {}
          setSession(null);
          setUser(null);
          setLoading(false);
          return;
        }
      }
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return { user, session, loading, signOut };
};
