import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useGroups } from "@/hooks/useGroups";
import { fetchUnreadCountsByGroup } from "@/lib/chat/groupQueries";
import { supabase } from "@/integrations/supabase/client";
import UserAvatar from "@/components/chat/UserAvatar";
import { ArrowRight, Loader2, Plus, Link2 } from "lucide-react";

const roleLabel = (role: string) => (role === "owner" ? "مالك" : role === "admin" ? "مشرف" : "عضو");

export default function GroupsList() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { groups, loading, reload } = useGroups();
  const [unreadCounts, setUnreadCounts] = useState<Map<string, number>>(new Map());

  const loadUnread = useCallback(async () => {
    if (!user) return;
    setUnreadCounts(await fetchUnreadCountsByGroup());
  }, [user]);

  useEffect(() => {
    loadUnread();
    if (!user) return;
    const ch = supabase
      .channel(`groups-list:${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "group_messages" }, () => { loadUnread(); reload(); })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "groups" }, () => reload())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, loadUnread, reload]);

  return (
    <div className="p-4 space-y-6" dir="rtl">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate("/chat")} className="text-primary">
          <ArrowRight className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-horror text-primary flex-1">الجروبات</h1>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Link
          to="/chat/groups/new"
          className="card-horror p-4 flex flex-col items-center gap-2 hover:border-primary/60 transition-colors"
        >
          <Plus className="w-6 h-6 text-primary" />
          <span className="text-sm font-typewriter">إنشاء جروب</span>
        </Link>
        <Link
          to="/chat/groups/join"
          className="card-horror p-4 flex flex-col items-center gap-2 hover:border-primary/60 transition-colors"
        >
          <Link2 className="w-6 h-6 text-primary" />
          <span className="text-sm font-typewriter">الانضمام برابط</span>
        </Link>
      </div>

      {loading ? (
        <div className="flex justify-center pt-10">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : groups.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground font-typewriter py-10">
          لسه مالكش أي جروب — أنشئ جروب جديد أو انضم لواحد برابط دعوة
        </p>
      ) : (
        <ul className="space-y-2">
          {groups.map((g) => {
            const unread = unreadCounts.get(g.id) ?? 0;
            const preview = g.last_message_preview ?? g.description;
            return (
              <li key={g.id}>
                <Link
                  to={`/chat/g/${g.id}`}
                  className="flex items-center gap-3 card-horror p-3 hover:border-primary/60 transition-colors"
                >
                  <UserAvatar url={g.avatar_url} username={g.name} />
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline">
                      <span className="font-horror text-primary truncate">{g.name}</span>
                      {g.last_message_at && (
                        <span className={`text-[10px] shrink-0 mr-2 ${unread > 0 ? "text-primary" : "text-muted-foreground"}`}>
                          {new Date(g.last_message_at).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      )}
                    </div>
                    <div className="flex justify-between items-center gap-2">
                      {preview && (
                        <p className={`text-xs truncate font-typewriter ${unread > 0 ? "text-foreground font-bold" : "text-foreground/70"}`}>
                          {preview}
                        </p>
                      )}
                      {unread > 0 && (
                        <span className="bg-destructive text-destructive-foreground text-[10px] rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 shrink-0">
                          {unread > 9 ? "9+" : unread}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0">{roleLabel(g.myRole)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
