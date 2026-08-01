// شريط أفقي أعلى ChatHome بيعرض: ستوري نفسي (مع زر +) وبعده أصدقائي
// اللي عندهم ستوري ساري حاليًا. حلقة التوهج تتلون بلون primary لو
// فيه ستوري لسه ماتشافش، وتبقى باهتة لو كل الستوريهات اتشافت.

import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import UserAvatar from "./UserAvatar";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import {
  createMediaStory,
  createTextStory,
  fetchActiveStoryGroups,
  type StoryGroup,
} from "@/lib/chat/storyQueries";
import type { PublicProfile } from "@/lib/chat/queries";
import { toast } from "sonner";

const BG_COLORS = ["#7c3aed", "#0891b2", "#dc2626", "#16a34a", "#ca8a04", "#1e293b"];

export default function StoriesBar({ friends }: { friends: PublicProfile[] }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [groups, setGroups] = useState<StoryGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);

  const load = async () => {
    if (!user) return;
    try {
      const g = await fetchActiveStoryGroups(user.id, friends);
      setGroups(g);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, friends.length]);

  const myGroup = groups.find((g) => g.user.user_id === user?.id);
  const others = groups.filter((g) => g.user.user_id !== user?.id);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !user) return;
    setUploading(true);
    try {
      await createMediaStory(user.id, file, file.type);
      toast.success("تم نشر الستوري");
      load();
    } catch (err: any) {
      toast.error(err?.message ?? "تعذر نشر الستوري");
    } finally {
      setUploading(false);
    }
  };

  const quickTextStory = async () => {
    const text = window.prompt("اكتب نص الستوري:");
    if (!text) return;
    if (!user) return;
    try {
      await createTextStory(user.id, text, BG_COLORS[Math.floor(Math.random() * BG_COLORS.length)]);
      toast.success("تم نشر الستوري");
      load();
    } catch (err: any) {
      toast.error(err?.message ?? "تعذر نشر الستوري");
    }
  };

  if (loading) return null;

  return (
    <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1">
      <input ref={fileInputRef} type="file" accept="image/*,video/*" hidden onChange={handleFile} />

      {/* ستوري نفسي */}
      <div className="flex flex-col items-center gap-1 shrink-0">
        <div className="relative">
          <button
            onClick={() => (myGroup ? navigate(`/chat/story/${user!.id}`) : fileInputRef.current?.click())}
            className={cn(
              "rounded-full p-[2px]",
              myGroup && !myGroup.allViewed ? "bg-gradient-to-tr from-primary to-accent" : "bg-transparent"
            )}
          >
            <UserAvatar url={null} username="أنا" size="lg" />
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="absolute -bottom-1 -left-1 bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center border-2 border-background"
            title="أضف ستوري"
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>
        <button onClick={quickTextStory} className="text-[10px] text-white/70 font-typewriter">
          نصي؟
        </button>
      </div>

      {others.map((g) => (
        <button
          key={g.user.user_id}
          onClick={() => navigate(`/chat/story/${g.user.user_id}`)}
          className="flex flex-col items-center gap-1 shrink-0"
        >
          <div
            className={cn(
              "rounded-full p-[2px]",
              g.allViewed ? "bg-white/20" : "bg-gradient-to-tr from-primary to-accent"
            )}
          >
            <UserAvatar url={g.user.avatar_url} username={g.user.username} size="lg" />
          </div>
          <span className="text-[10px] text-white/80 max-w-[60px] truncate font-typewriter">
            {g.user.username}
          </span>
        </button>
      ))}
    </div>
  );
}
