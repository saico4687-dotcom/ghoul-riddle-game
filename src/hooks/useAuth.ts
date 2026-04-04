import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import type { User, Session } from "@supabase/supabase-js";

interface Profile {
  user_id: string;
  email: string | null;
  name: string | null;
  profile_image: string | null;
  last_puzzle_index: number;
}

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (data && !error) {
      setProfile({
        user_id: data.user_id,
        email: data.email,
        name: data.name,
        profile_image: data.profile_image,
        last_puzzle_index: data.last_puzzle_index,
      });
    }
    return data;
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session: Session | null) => {
        if (session?.user) {
          setUser(session.user);
          // Use setTimeout to avoid potential deadlock with Supabase auth
          setTimeout(() => fetchProfile(session.user.id), 0);
        } else {
          setUser(null);
          setProfile(null);
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        fetchProfile(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  const signInWithGoogle = useCallback(async () => {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });

    if (result.error) {
      console.error("Google sign-in error:", result.error);
      return { error: result.error };
    }

    if (result.redirected) {
      return { redirected: true };
    }

    return { success: true };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  }, []);

  const updateLastPuzzleIndex = useCallback(async (index: number) => {
    if (!user) return;
    const { error } = await supabase
      .from("profiles")
      .update({ last_puzzle_index: index, updated_at: new Date().toISOString() })
      .eq("user_id", user.id);
    
    if (!error) {
      setProfile(prev => prev ? { ...prev, last_puzzle_index: index } : null);
    }
  }, [user]);

  return {
    user,
    profile,
    loading,
    signInWithGoogle,
    signOut,
    updateLastPuzzleIndex,
    fetchProfile,
  };
};
