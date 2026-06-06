import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User as UserIcon } from "lucide-react";

interface ProfileInfo {
  name: string | null;
  full_name: string | null;
  profile_image: string | null;
  email: string | null;
}

const UserHeader = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<ProfileInfo | null>(null);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("name,full_name,profile_image,email")
        .eq("user_id", user.id)
        .maybeSingle();
      setProfile(data ?? null);
    })();
  }, [user]);

  if (!user) return null;

  const displayName =
    profile?.full_name?.trim() ||
    profile?.name?.trim() ||
    (user.user_metadata as { full_name?: string; name?: string })?.full_name ||
    (user.user_metadata as { full_name?: string; name?: string })?.name ||
    profile?.email ||
    user.email ||
    "مستخدم";

  const avatarUrl =
    profile?.profile_image ||
    (user.user_metadata as { avatar_url?: string; picture?: string })?.avatar_url ||
    (user.user_metadata as { avatar_url?: string; picture?: string })?.picture ||
    "";

  const initial = (displayName || "?").charAt(0).toUpperCase();

  return (
    <div
      dir="rtl"
      className="fixed top-3 right-3 z-30 flex items-center gap-2 px-3 py-1.5 rounded-full bg-card/80 border border-primary/40 backdrop-blur-md shadow-md max-w-[70vw]"
    >
      <Avatar className="h-8 w-8 ring-1 ring-primary/40">
        {avatarUrl ? <AvatarImage src={avatarUrl} alt={displayName} /> : null}
        <AvatarFallback className="bg-primary/20 text-primary text-xs">
          {initial || <UserIcon className="w-4 h-4" />}
        </AvatarFallback>
      </Avatar>
      <span className="font-typewriter text-xs sm:text-sm text-foreground/90 truncate max-w-[140px]">
        {displayName}
      </span>
    </div>
  );
};

export default UserHeader;
