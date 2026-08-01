import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import {
  listFriends,
  listMyConversations,
  listIncomingRequests,
  fetchPublicProfilesByIds,
  fetchPresenceForUsers,
  fetchUnreadCountsByConversation,
  toggleConversationArchived,
  toggleConversationPinned,
  isOnline,
  type PublicProfile,
  type Conversation,
} from "@/lib/chat/queries";
import UserAvatar from "@/components/chat/UserAvatar";
import StoriesBar from "@/components/chat/StoriesBar";
import { Loader2, MessageCircle, Search, Users, UserPlus, Pin, Archive, ArchiveRestore } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { isLocationBody } from "@/lib/chat/formatting";
import { isEncryptedBody } from "@/lib/chat/e2e";

// معاينة آخر رسالة في القائمة: لو الرسالة متشفّرة (E2E) أو مشاركة موقع،
// السيرفر نفسه مايعرفش محتواها الحقيقي (أو مش نص حر أصلًا) فبنعرض وصف
// عام بدل النص الخام (base64 مشفّر أو إحداثيات).
function previewFor(preview: string | null | undefined): string {
  if (!preview) return "ابدأ المحادثة...";
  if (isEncryptedBody(preview)) return "🔒 رسالة مشفّرة";
  if (isLocationBody(preview)) return "📍 موقع مُشارك";
  return preview;
}

export default function ChatHome() {
  const { user } = useAuth();
  const [friends, setFriends] = useState<PublicProfile[]>([]);
  const [convos, setConvos] = useState<Conversation[]>([]);
  const [profiles, setProfiles] = useState<Map<string, PublicProfile>>(new Map());
  const [presence, setPresence] = useState<Map<string, any>>(new Map());
  const [unreadCounts, setUnreadCounts] = useState<Map<string, number>>(new Map());
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const [fr, cs, inc, unread] = await Promise.all([
      listFriends(user.id),
      listMyConversations(user.id),
      listIncomingRequests(user.id),
      fetchUnreadCountsByConversation(),
    ]);
    const friendIds = fr.map((f: any) => f.friend_id);
    const otherIds = cs.map((c) => (c.user_a === user.id ? c.user_b : c.user_a));
    const allIds = Array.from(new Set([...friendIds, ...otherIds]));
    const [profs, pres] = await Promise.all([
      fetchPublicProfilesByIds(allIds),
      fetchPresenceForUsers(allIds),
    ]);
    const pm = new Map(profs.map((p) => [p.user_id, p]));
    const presMap = new Map((pres as any[]).map((p) => [p.user_id, p]));
    setProfiles(pm);
    setPresence(presMap);
    setFriends(friendIds.map((id: string) => pm.get(id)).filter(Boolean) as PublicProfile[]);
    setConvos(cs);
    setUnreadCounts(unread);
    setPendingCount(inc.length);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
    if (!user) return;
    const ch = supabase
      .channel(`home:${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "user_presence" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "friend_requests", filter: `to_user=eq.${user.id}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "friends", filter: `user_id=eq.${user.id}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, load]);

  if (loading) return <div className="flex justify-center pt-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  const onlineCount = friends.filter((f) => isOnline(presence.get(f.user_id))).length;

  const archivedConvos = convos.filter((c) => (c.archived_by ?? []).includes(user!.id));
  const sortByPinnedThenDate = (list: Conversation[]) =>
    [...list].sort((a, b) => {
      const aPinned = (a.pinned_by ?? []).includes(user!.id);
      const bPinned = (b.pinned_by ?? []).includes(user!.id);
      if (aPinned !== bPinned) return aPinned ? -1 : 1;
      return new Date(b.last_message_at ?? b.created_at).getTime() - new Date(a.last_message_at ?? a.created_at).getTime();
    });
  const visibleConvos = sortByPinnedThenDate(
    showArchived ? archivedConvos : convos.filter((c) => !(c.archived_by ?? []).includes(user!.id))
  );

  const handleTogglePin = async (c: Conversation) => {
    const next = await toggleConversationPinned(c, user!.id);
    setConvos((prev) => prev.map((x) => (x.id === c.id ? { ...x, pinned_by: next } : x)));
  };
  const handleToggleArchive = async (c: Conversation) => {
    const next = await toggleConversationArchived(c, user!.id);
    setConvos((prev) => prev.map((x) => (x.id === c.id ? { ...x, archived_by: next } : x)));
  };

  return (
    <div className="p-4 space-y-6">
      <StoriesBar friends={friends} />

      {pendingCount > 0 && (
        <Link
          to="/chat/friends"
          className="card-horror p-3 flex items-center gap-3 border-primary/60 hover:border-primary transition-colors"
        >
          <UserPlus className="w-5 h-5 text-primary" />
          <div className="flex-1">
            <div className="font-horror text-primary text-sm">لديك {pendingCount} طلب صداقة جديد</div>
            <div className="text-[11px] text-muted-foreground font-typewriter">اضغط للعرض والرد</div>
          </div>
          <span className="bg-destructive text-destructive-foreground text-[10px] rounded-full px-2 py-0.5">{pendingCount}</span>
        </Link>
      )}

      <Link
        to="/chat/groups"
        className="card-horror p-3 flex items-center gap-3 hover:border-primary/60 transition-colors"
      >
        <Users className="w-5 h-5 text-primary" />
        <div className="flex-1">
          <div className="font-horror text-primary text-sm">الجروبات</div>
          <div className="text-[11px] text-muted-foreground font-typewriter">إنشاء جروب أو الانضمام برابط دعوة</div>
        </div>
      </Link>

      <div className="grid grid-cols-2 gap-3">
        <div className="card-horror p-4 text-center">
          <div className="text-3xl font-horror text-primary">{friends.length}</div>
          <div className="text-xs font-typewriter text-muted-foreground flex items-center justify-center gap-1 mt-1">
            <Users className="w-3 h-3" /> أصدقاء
          </div>
        </div>
        <div className="card-horror p-4 text-center">
          <div className="text-3xl font-horror text-emerald-400">{onlineCount}</div>
          <div className="text-xs font-typewriter text-muted-foreground flex items-center justify-center gap-1 mt-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" /> متصلون
          </div>
        </div>
      </div>

      <section>
        <h2 className="font-horror text-primary mb-2 flex items-center justify-between">
          <span>أصدقاء متصلون</span>
          <Link to="/chat/friends" className="text-xs text-muted-foreground hover:text-primary">عرض الكل</Link>
        </h2>
        {friends.filter((f) => isOnline(presence.get(f.user_id))).length === 0 ? (
          <p className="text-sm text-muted-foreground font-typewriter">لا يوجد أصدقاء متصلون الآن</p>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-2">
            {friends.filter((f) => isOnline(presence.get(f.user_id))).map((f) => (
              <Link key={f.user_id} to={`/chat/u/${f.username}`} className="flex flex-col items-center gap-1 shrink-0">
                <UserAvatar url={f.avatar_url} username={f.username} online size="lg" />
                <span className="text-xs font-typewriter max-w-[64px] truncate">{f.username}</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="font-horror text-primary mb-2 flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <MessageCircle className="w-4 h-4" /> {showArchived ? "المحادثات المؤرشفة" : "المحادثات الأخيرة"}
          </span>
          {archivedConvos.length > 0 && (
            <button
              onClick={() => setShowArchived((v) => !v)}
              className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 font-typewriter"
            >
              {showArchived ? (
                <>رجوع للمحادثات</>
              ) : (
                <>
                  <Archive className="w-3 h-3" /> الأرشيف ({archivedConvos.length})
                </>
              )}
            </button>
          )}
        </h2>
        {visibleConvos.length === 0 ? (
          <div className="text-center py-12">
            {showArchived ? (
              <p className="text-muted-foreground font-typewriter">لا توجد محادثات مؤرشفة</p>
            ) : (
              <>
                <p className="text-muted-foreground font-typewriter mb-4">لا توجد محادثات بعد</p>
                <Link to="/chat/search" className="inline-flex items-center gap-2 text-primary border border-primary/40 rounded-md px-4 py-2">
                  <Search className="w-4 h-4" /> ابحث عن أصدقاء
                </Link>
              </>
            )}
          </div>
        ) : (
          <ul className="space-y-2">
            {visibleConvos.map((c) => {
              const otherId = c.user_a === user!.id ? c.user_b : c.user_a;
              const p = profiles.get(otherId);
              const online = isOnline(presence.get(otherId));
              const unread = unreadCounts.get(c.id) ?? 0;
              const pinned = (c.pinned_by ?? []).includes(user!.id);
              const archived = (c.archived_by ?? []).includes(user!.id);
              return (
                <li key={c.id} className="relative group">
                  <Link to={`/chat/c/${c.id}`} className="flex items-center gap-3 card-horror p-3 hover:border-primary/60 transition-colors">
                    <UserAvatar url={p?.avatar_url} username={p?.username} online={online} />
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-baseline">
                        <span className={`font-horror truncate flex items-center gap-1 ${unread > 0 ? "text-primary" : "text-primary/90"}`}>
                          {pinned && <Pin className="w-3 h-3 shrink-0" />}
                          {p?.username ?? "..."}
                        </span>
                        {c.last_message_at && (
                          <span className={`text-[10px] shrink-0 mr-2 ${unread > 0 ? "text-primary" : "text-muted-foreground"}`}>
                            {new Date(c.last_message_at).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        )}
                      </div>
                      <div className="flex justify-between items-center gap-2">
                        <p className={`text-xs truncate font-typewriter ${unread > 0 ? "text-foreground font-bold" : "text-foreground/70"}`}>
                          {previewFor(c.last_message_preview)}
                        </p>
                        {unread > 0 && (
                          <span className="bg-destructive text-destructive-foreground text-[10px] rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 shrink-0">
                            {unread > 9 ? "9+" : unread}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                  <div className="absolute top-2 left-2 flex gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleTogglePin(c); }}
                      className="p-1 rounded-full bg-card border border-border hover:bg-muted"
                      aria-label={pinned ? "إلغاء التثبيت" : "تثبيت المحادثة"}
                    >
                      <Pin className={`w-3 h-3 ${pinned ? "text-primary" : ""}`} />
                    </button>
                    <button
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleToggleArchive(c); }}
                      className="p-1 rounded-full bg-card border border-border hover:bg-muted"
                      aria-label={archived ? "إلغاء الأرشفة" : "أرشفة المحادثة"}
                    >
                      {archived ? <ArchiveRestore className="w-3 h-3" /> : <Archive className="w-3 h-3" />}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
        }
