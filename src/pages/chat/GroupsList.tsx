import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useGroups, type MyGroup } from "@/hooks/useGroups";
import { fetchUnreadCountsByGroup, toggleGroupArchived, toggleGroupPinned } from "@/lib/chat/groupQueries";
import { supabase } from "@/integrations/supabase/client";
import UserAvatar from "@/components/chat/UserAvatar";
import { ArrowRight, Loader2, Plus, Link2, Pin, Archive, ArchiveRestore } from "lucide-react";
import { isLocationBody } from "@/lib/chat/formatting";

const roleLabel = (role: string) => (role === "owner" ? "مالك" : role === "admin" ? "مشرف" : "عضو");

export default function GroupsList() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { groups, loading, reload } = useGroups();
  const [unreadCounts, setUnreadCounts] = useState<Map<string, number>>(new Map());
  const [showArchived, setShowArchived] = useState(false);
  // override محلي عشان الزرار يستجيب فورًا من غير ما ننتظر reload() كامل
  // من الداتابيز (اللي بيجيب كل بيانات الجروبات تاني).
  const [overrides, setOverrides] = useState<Record<string, { archived?: boolean; pinned?: boolean }>>({});

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

  const effectiveGroups: MyGroup[] = groups.map((g) => ({ ...g, ...overrides[g.id] }));
  const archivedGroups = effectiveGroups.filter((g) => g.archived);
  const visibleGroups = [...(showArchived ? archivedGroups : effectiveGroups.filter((g) => !g.archived))].sort(
    (a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return new Date(b.last_message_at ?? b.created_at).getTime() - new Date(a.last_message_at ?? a.created_at).getTime();
    }
  );

  const handleTogglePin = async (g: MyGroup) => {
    const next = await toggleGroupPinned(g.id, user!.id, g.pinned);
    setOverrides((cur) => ({ ...cur, [g.id]: { ...cur[g.id], pinned: next } }));
  };
  const handleToggleArchive = async (g: MyGroup) => {
    const next = await toggleGroupArchived(g.id, user!.id, g.archived);
    setOverrides((cur) => ({ ...cur, [g.id]: { ...cur[g.id], archived: next } }));
  };

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
      ) : (
        <div>
          {archivedGroups.length > 0 && (
            <div className="flex justify-end mb-2">
              <button
                onClick={() => setShowArchived((v) => !v)}
                className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 font-typewriter"
              >
                {showArchived ? (
                  <>رجوع للجروبات</>
                ) : (
                  <>
                    <Archive className="w-3 h-3" /> الأرشيف ({archivedGroups.length})
                  </>
                )}
              </button>
            </div>
          )}
          {visibleGroups.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground font-typewriter py-10">
              {showArchived ? "لا توجد جروبات مؤرشفة" : "لسه مالكش أي جروب — أنشئ جروب جديد أو انضم لواحد برابط دعوة"}
            </p>
          ) : (
            <ul className="space-y-2">
              {visibleGroups.map((g) => {
                const unread = unreadCounts.get(g.id) ?? 0;
                const rawPreview = g.last_message_preview ?? g.description;
                const preview = rawPreview && isLocationBody(rawPreview) ? "📍 موقع مُشارك" : rawPreview;
                return (
                  <li key={g.id} className="relative group">
                    <Link
                      to={`/chat/g/${g.id}`}
                      className="flex items-center gap-3 card-horror p-3 hover:border-primary/60 transition-colors"
                    >
                      <UserAvatar url={g.avatar_url} username={g.name} />
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-baseline">
                          <span className="font-horror text-primary truncate flex items-center gap-1">
                            {g.pinned && <Pin className="w-3 h-3 shrink-0" />}
                            {g.name}
                          </span>
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
                    <div className="absolute top-2 left-2 flex gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleTogglePin(g); }}
                        className="p-1 rounded-full bg-card border border-border hover:bg-muted"
                        aria-label={g.pinned ? "إلغاء التثبيت" : "تثبيت الجروب"}
                      >
                        <Pin className={`w-3 h-3 ${g.pinned ? "text-primary" : ""}`} />
                      </button>
                      <button
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleToggleArchive(g); }}
                        className="p-1 rounded-full bg-card border border-border hover:bg-muted"
                        aria-label={g.archived ? "إلغاء الأرشفة" : "أرشفة الجروب"}
                      >
                        {g.archived ? <ArchiveRestore className="w-3 h-3" /> : <Archive className="w-3 h-3" />}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
