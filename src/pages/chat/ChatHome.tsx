import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import {
  listFriends,
  listMyConversations,
  listIncomingRequests,
  fetchPublicProfilesByIds,
  fetchPresenceForUsers,
  isOnline,
  type PublicProfile,
  type Conversation,
} from "@/lib/chat/queries";
import UserAvatar from "@/components/chat/UserAvatar";
import { Loader2, MessageCircle, Search, Users, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export default function ChatHome() {
  const { user } = useAuth();
  const [friends, setFriends] = useState<PublicProfile[]>([]);
  const [convos, setConvos] = useState<Conversation[]>([]);
  const [profiles, setProfiles] = useState<Map<string, PublicProfile>>(new Map());
  const [presence, setPresence] = useState<Map<string, any>>(new Map());
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    const [fr, cs, inc] = await Promise.all([
      listFriends(user.id),
      listMyConversations(user.id),
      listIncomingRequests(user.id),
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
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, load]);


  if (loading) return <div className="flex justify-center pt-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  const onlineCount = friends.filter((f) => isOnline(presence.get(f.user_id))).length;

  return (
    <div className="p-4 space-y-6">
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
        <h2 className="font-horror text-primary mb-2 flex items-center gap-2">
          <MessageCircle className="w-4 h-4" /> المحادثات الأخيرة
        </h2>
        {convos.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground font-typewriter mb-4">لا توجد محادثات بعد</p>
            <Link to="/chat/search" className="inline-flex items-center gap-2 text-primary border border-primary/40 rounded-md px-4 py-2">
              <Search className="w-4 h-4" /> ابحث عن أصدقاء
            </Link>
          </div>
        ) : (
          <ul className="space-y-2">
            {convos.map((c) => {
              const otherId = c.user_a === user!.id ? c.user_b : c.user_a;
              const p = profiles.get(otherId);
              const online = isOnline(presence.get(otherId));
              return (
                <li key={c.id}>
                  <Link to={`/chat/c/${c.id}`} className="flex items-center gap-3 card-horror p-3 hover:border-primary/60 transition-colors">
                    <UserAvatar url={p?.avatar_url} username={p?.username} online={online} />
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-baseline">
                        <span className="font-horror text-primary truncate">{p?.username ?? "..."}</span>
                        {c.last_message_at && (
                          <span className="text-[10px] text-muted-foreground shrink-0 mr-2">
                            {new Date(c.last_message_at).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-foreground/70 truncate font-typewriter">{c.last_message_preview ?? "ابدأ المحادثة..."}</p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
