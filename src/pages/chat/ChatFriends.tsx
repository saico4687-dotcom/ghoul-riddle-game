import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import {
  listFriends,
  listIncomingRequests,
  listOutgoingRequests,
  fetchPublicProfilesByIds,
  fetchPresenceForUsers,
  isOnline,
  respondFriendRequest,
  cancelFriendRequest,
  removeFriend,
  blockUser,
  type PublicProfile,
  type FriendRequest,
} from "@/lib/chat/queries";
import UserAvatar from "@/components/chat/UserAvatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Check, X, Loader2, MessageCircle, UserMinus, Ban } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export default function ChatFriends() {
  const { user } = useAuth();
  const [friends, setFriends] = useState<PublicProfile[]>([]);
  const [presence, setPresence] = useState<Map<string, any>>(new Map());
  const [incoming, setIncoming] = useState<(FriendRequest & { profile?: PublicProfile })[]>([]);
  const [outgoing, setOutgoing] = useState<(FriendRequest & { profile?: PublicProfile })[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    const [fr, inc, out] = await Promise.all([
      listFriends(user.id),
      listIncomingRequests(user.id),
      listOutgoingRequests(user.id),
    ]);
    const friendIds = fr.map((f: any) => f.friend_id);
    const ids = Array.from(new Set([
      ...friendIds,
      ...inc.map((r) => r.from_user),
      ...out.map((r) => r.to_user),
    ]));
    const [profs, pres] = await Promise.all([
      fetchPublicProfilesByIds(ids),
      fetchPresenceForUsers(friendIds),
    ]);
    const map = new Map(profs.map((p) => [p.user_id, p]));
    setFriends(friendIds.map((id: string) => map.get(id)).filter(Boolean) as PublicProfile[]);
    setPresence(new Map((pres as any[]).map((p) => [p.user_id, p])));
    setIncoming(inc.map((r) => ({ ...r, profile: map.get(r.from_user) })));
    setOutgoing(out.map((r) => ({ ...r, profile: map.get(r.to_user) })));
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
    if (!user) return;
    const ch = supabase
      .channel(`friends:${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "friend_requests" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "friends" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, load]);

  const respond = async (uid: string, id: string, accept: boolean) => {
    setBusy(uid);
    try {
      await respondFriendRequest(id, accept);
      toast.success(accept ? "تمت إضافة الصديق" : "تم الرفض");
      load();
    } finally { setBusy(null); }
  };

  const cancel = async (uid: string, id: string) => {
    setBusy(uid);
    try {
      await cancelFriendRequest(id);
      toast.success("تم إلغاء الطلب");
      load();
    } finally { setBusy(null); }
  };

  const unfriend = async (uid: string) => {
    if (!user) return;
    if (!confirm("إزالة هذا الصديق؟")) return;
    setBusy(uid);
    try {
      await removeFriend(user.id, uid);
      toast.success("تمت الإزالة");
      load();
    } finally { setBusy(null); }
  };

  const block = async (uid: string) => {
    if (!user) return;
    if (!confirm("حظر هذا المستخدم؟ سيتم إزالته من قائمة الأصدقاء.")) return;
    setBusy(uid);
    try {
      await blockUser(user.id, uid);
      toast.success("تم الحظر");
      load();
    } catch (e: any) {
      toast.error(e.message || "تعذّر الحظر");
    } finally { setBusy(null); }
  };

  if (loading) return <div className="flex justify-center pt-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div className="p-4">
      <Tabs defaultValue={incoming.length > 0 ? "incoming" : "friends"}>
        <TabsList className="grid grid-cols-3 w-full">
          <TabsTrigger value="friends">أصدقاء ({friends.length})</TabsTrigger>
          <TabsTrigger value="incoming" className="relative">
            واردة ({incoming.length})
            {incoming.length > 0 && <span className="absolute top-1 left-1 w-2 h-2 rounded-full bg-destructive" />}
          </TabsTrigger>
          <TabsTrigger value="outgoing">صادرة ({outgoing.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="friends" className="space-y-2 mt-4">
          {friends.length === 0 ? (
            <div className="text-center py-10 space-y-2">
              <p className="text-muted-foreground font-typewriter">لا يوجد أصدقاء بعد</p>
              <Link to="/chat/search" className="inline-block text-primary text-sm border border-primary/40 rounded-md px-4 py-2">ابحث عن أصدقاء</Link>
            </div>
          ) : friends.map((f) => {
            const online = isOnline(presence.get(f.user_id));
            const isBusy = busy === f.user_id;
            return (
              <div key={f.user_id} className="flex items-center gap-3 card-horror p-3">
                <Link to={`/chat/u/${f.username}`} className="flex items-center gap-3 flex-1 min-w-0">
                  <UserAvatar url={f.avatar_url} username={f.username} online={online} />
                  <div className="flex-1 min-w-0">
                    <div className="font-horror text-primary truncate">{f.username}</div>
                    <div className="text-xs text-muted-foreground font-typewriter">
                      {online ? "متصل الآن" : `${f.riddles_completed} لغز`}
                    </div>
                  </div>
                </Link>
                <div className="flex items-center gap-1 shrink-0">
                  <Link to={`/chat/u/${f.username}`} aria-label="فتح المحادثة" className="p-2 rounded-md text-primary hover:bg-accent">
                    <MessageCircle className="w-4 h-4" />
                  </Link>
                  <Button size="icon" variant="ghost" disabled={isBusy} onClick={() => unfriend(f.user_id)} aria-label="إزالة">
                    <UserMinus className="w-4 h-4" />
                  </Button>
                  <Button size="icon" variant="ghost" disabled={isBusy} onClick={() => block(f.user_id)} aria-label="حظر">
                    <Ban className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </TabsContent>

        <TabsContent value="incoming" className="space-y-2 mt-4">
          {incoming.length === 0 ? <p className="text-center text-muted-foreground font-typewriter py-8">لا توجد طلبات واردة</p>
            : incoming.map((r) => {
              const isBusy = busy === r.from_user;
              return (
                <div key={r.id} className="flex items-center gap-3 card-horror p-3">
                  <UserAvatar url={r.profile?.avatar_url} username={r.profile?.username} />
                  <div className="flex-1 min-w-0">
                    <Link to={`/chat/u/${r.profile?.username}`} className="font-horror text-primary truncate block">{r.profile?.username ?? "..."}</Link>
                    <div className="text-[11px] text-muted-foreground">{new Date(r.created_at).toLocaleString("ar-EG")}</div>
                  </div>
                  <Button size="sm" disabled={isBusy} onClick={() => respond(r.from_user, r.id, true)}>
                    {isBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  </Button>
                  <Button size="sm" variant="outline" disabled={isBusy} onClick={() => respond(r.from_user, r.id, false)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              );
            })}
        </TabsContent>

        <TabsContent value="outgoing" className="space-y-2 mt-4">
          {outgoing.length === 0 ? <p className="text-center text-muted-foreground font-typewriter py-8">لا توجد طلبات صادرة</p>
            : outgoing.map((r) => {
              const isBusy = busy === r.to_user;
              return (
                <div key={r.id} className="flex items-center gap-3 card-horror p-3">
                  <UserAvatar url={r.profile?.avatar_url} username={r.profile?.username} />
                  <div className="flex-1 min-w-0">
                    <Link to={`/chat/u/${r.profile?.username}`} className="font-horror text-primary truncate block">{r.profile?.username ?? "..."}</Link>
                    <div className="text-xs text-muted-foreground">في الانتظار</div>
                  </div>
                  <Button size="sm" variant="outline" disabled={isBusy} onClick={() => cancel(r.to_user, r.id)}>
                    إلغاء
                  </Button>
                </div>
              );
            })}
        </TabsContent>
      </Tabs>
    </div>
  );
}
