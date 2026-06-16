import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import {
  listFriends,
  listIncomingRequests,
  listOutgoingRequests,
  fetchPublicProfilesByIds,
  respondFriendRequest,
  type PublicProfile,
  type FriendRequest,
} from "@/lib/chat/queries";
import UserAvatar from "@/components/chat/UserAvatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Check, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function ChatFriends() {
  const { user } = useAuth();
  const [friends, setFriends] = useState<PublicProfile[]>([]);
  const [incoming, setIncoming] = useState<(FriendRequest & { profile?: PublicProfile })[]>([]);
  const [outgoing, setOutgoing] = useState<(FriendRequest & { profile?: PublicProfile })[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const [fr, inc, out] = await Promise.all([
      listFriends(user.id),
      listIncomingRequests(user.id),
      listOutgoingRequests(user.id),
    ]);
    const ids = Array.from(new Set([
      ...fr.map((f: any) => f.friend_id),
      ...inc.map((r) => r.from_user),
      ...out.map((r) => r.to_user),
    ]));
    const profs = await fetchPublicProfilesByIds(ids);
    const map = new Map(profs.map((p) => [p.user_id, p]));
    setFriends(fr.map((f: any) => map.get(f.friend_id)).filter(Boolean) as PublicProfile[]);
    setIncoming(inc.map((r) => ({ ...r, profile: map.get(r.from_user) })));
    setOutgoing(out.map((r) => ({ ...r, profile: map.get(r.to_user) })));
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const respond = async (id: string, accept: boolean) => {
    await respondFriendRequest(id, accept);
    toast.success(accept ? "تم القبول" : "تم الرفض");
    load();
  };

  if (loading) return <div className="flex justify-center pt-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div className="p-4">
      <Tabs defaultValue="friends">
        <TabsList className="grid grid-cols-3 w-full">
          <TabsTrigger value="friends">أصدقاء ({friends.length})</TabsTrigger>
          <TabsTrigger value="incoming">واردة ({incoming.length})</TabsTrigger>
          <TabsTrigger value="outgoing">صادرة ({outgoing.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="friends" className="space-y-2 mt-4">
          {friends.length === 0 ? <p className="text-center text-muted-foreground font-typewriter py-8">لا يوجد أصدقاء بعد</p>
            : friends.map((f) => (
              <Link key={f.user_id} to={`/chat/u/${f.username}`} className="flex items-center gap-3 card-horror p-3">
                <UserAvatar url={f.avatar_url} username={f.username} />
                <div className="flex-1">
                  <div className="font-horror text-primary">{f.username}</div>
                  <div className="text-xs text-muted-foreground">{f.riddles_completed} لغز</div>
                </div>
              </Link>
            ))}
        </TabsContent>

        <TabsContent value="incoming" className="space-y-2 mt-4">
          {incoming.length === 0 ? <p className="text-center text-muted-foreground font-typewriter py-8">لا توجد طلبات واردة</p>
            : incoming.map((r) => (
              <div key={r.id} className="flex items-center gap-3 card-horror p-3">
                <UserAvatar url={r.profile?.avatar_url} username={r.profile?.username} />
                <div className="flex-1 min-w-0">
                  <Link to={`/chat/u/${r.profile?.username}`} className="font-horror text-primary truncate block">{r.profile?.username ?? "..."}</Link>
                </div>
                <Button size="sm" onClick={() => respond(r.id, true)}><Check className="w-4 h-4" /></Button>
                <Button size="sm" variant="outline" onClick={() => respond(r.id, false)}><X className="w-4 h-4" /></Button>
              </div>
            ))}
        </TabsContent>

        <TabsContent value="outgoing" className="space-y-2 mt-4">
          {outgoing.length === 0 ? <p className="text-center text-muted-foreground font-typewriter py-8">لا توجد طلبات صادرة</p>
            : outgoing.map((r) => (
              <div key={r.id} className="flex items-center gap-3 card-horror p-3">
                <UserAvatar url={r.profile?.avatar_url} username={r.profile?.username} />
                <div className="flex-1">
                  <Link to={`/chat/u/${r.profile?.username}`} className="font-horror text-primary">{r.profile?.username ?? "..."}</Link>
                  <div className="text-xs text-muted-foreground">في الانتظار</div>
                </div>
              </div>
            ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
