import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export type MyChatProfile = {
  user_id: string;
  username: string | null;
  avatar_url: string | null;
  completed: boolean;
  last_puzzle_index: number | null;
  is_muted_until: string | null;
  is_suspended_until: string | null;
};

// معيار موحّد لكل مكان في التطبيق: المستخدم "خلص" لو وصل لآخر لغز (400)
// سواء إجاباته صح أو غلط، أو لو علم completed اتظبط قبل كده. ده بالظبط
// نفس منطق الدالة has_completed_400 في قاعدة البيانات.
export function hasPassedAllPuzzles(p: Pick<MyChatProfile, "completed" | "last_puzzle_index"> | null | undefined) {
  return !!p && (p.completed === true || (p.last_puzzle_index ?? 0) >= 400);
}

export function useMyChatProfile() {
  const { user, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<MyChatProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = async () => {
    if (authLoading) {
      setLoading(true);
      return;
    }
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("user_id, username, avatar_url, completed, last_puzzle_index, is_muted_until, is_suspended_until")
      .eq("user_id", user.id)
      .maybeSingle();

    console.log("[useMyChatProfile] loaded", {
      userId: user.id,
      completed: data?.completed,
      username: data?.username,
      error,
    });
    setProfile((data as MyChatProfile) ?? null);
    setLoading(false);
  };

  useEffect(() => {
    reload();
  }, [user, authLoading]);

  return { profile, loading, reload };
}
