import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import {
  fetchPublicProfileByUsername,
  getOrCreateConversation,
  sendFriendRequest,
  removeFriend,
  blockUser,
  unblockUser,
  listFriends,
  listBlocked,
  listIncomingRequests,
  listOutgoingRequests,
  respondFriendRequest,
  fetchPresenceForUsers,
  isOnline,
  type PublicProfile,
  type FriendRequest,
} from "@/lib/chat/queries";
import UserAvatar from "@/components/chat/UserAvatar";
import { Button } from "@/components/ui/button";
import { Loader2, MessageCircle, UserPlus, UserMinus, Ban, Flag, Check, X } from "lucide-react";
import { toast } from "sonner";
import ReportDialog from "@/components/chat/ReportDialog";

export default function ChatProfile() {
  const { username } = useParams<{ username: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFriend, setIsFriend] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [incoming, setIncoming] = useState<FriendRequest | null>(null);
  const [outgoing, setOutgoing] = useState<FriendRequest | null>(null);
  const [online, setOnline] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  const load = async () => {
    if (!user || !username) return;
    setLoading(true);
    const p = await fetchPublicProfileByUsername(username);
    if (!p) { setLoading(false); setProfile(null); return; }
    setProfile(p);

    if (p.user_id === user.id) { setLoading(false); return; }

    const [friends, blocked, inc, out, pres] = await Promise.all([
      listFriends(user.id),
      listBlocked(user.id),
      listIncomingRequests(user.id),
      listOutgoingRequests(user.id),
      fetchPresenceForUsers([p.user_id]),
    ]);
    setIsFriend(friends.some((f: any) => f.friend_id === p.user_id));
    setIsBlocked(blocked.some((b: any) => b.blocked_id === p.user_id));
    setIncoming(inc.find((r) => r.from_user === p.user_id) ?? null);
    setOutgoing(out.find((r) => r.to_user === p.user_id) ?? null);
    setOnline(isOnline((pres as any[])[0]));
    setLoading(false);
  };

  useEffect(() => { load(); }, [username, user]);

  if (loading) return <div className="flex justify-center pt-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (!profile) return <div className="p-6 text-center font-typewriter">المستخدم غير موجود</div>;

  const isSelf = profile.user_id === user?.id;

  const openChat = async () => {
    try {
      const cid = await getOrCreateConversation(profile.user_id);
      navigate(`/chat/c/${cid}`);
    } catch (e: any) {
      toast.error(e?.message ?? "تعذر فتح المحادثة");
    }
  };

  const handleSendRequest = async () => {
    try { await sendFriendRequest(profile.user_id); toast.success("تم إرسال طلب الصداقة"); load(); }
    catch (e: any) { toast.error(e?.message ?? "فشل"); }
  };
  const handleRemove = async () => { await removeFriend(user!.id, profile.user_id); toast.success("تمت إزالة الصديق"); load(); };
  const handleBlock = async () => {
    try { await blockUser(user!.id, profile.user_id); toast.success("تم الحظر"); navigate("/chat"); }
    catch (e: any) { toast.error(e?.message ?? "فشل"); }
  };
  const handleUnblock = async () => { await unblockUser(user!.id, profile.user_id); toast.success("تم رفع الحظر"); load(); };
  const handleAccept = async () => { if (incoming) { await respondFriendRequest(incoming.id, true); load(); } };
  const handleReject = async () => { if (incoming) { await respondFriendRequest(incoming.id, false); load(); } };

  return (
    <div className="p-6">
      <div className="card-horror p-6 text-center">
        <div className="flex justify-center mb-4">
          <UserAvatar url={profile.avatar_url} username={profile.username} size="xl" online={online} />
        </div>
        <h1 className="font-horror text-3xl text-primary mb-1">{profile.username}</h1>
        <p className="text-sm text-muted-foreground font-typewriter mb-4">
          انضم في {new Date(profile.joined_at).toLocaleDateString("ar-EG")}
        </p>

        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="card-horror p-3">
            <div className="text-2xl font-horror text-primary">{profile.riddles_completed}</div>
            <div className="text-[10px] text-muted-foreground font-typewriter">لغز تم حله</div>
          </div>
          <div className="card-horror p-3">
            <div className="text-sm font-horror text-foreground">{online ? "متصل الآن" : "غير متصل"}</div>
            <div className="text-[10px] text-muted-foreground font-typewriter">
              {!online && profile.last_seen_at && `آخر ظهور ${new Date(profile.last_seen_at).toLocaleString("ar-EG")}`}
            </div>
          </div>
        </div>

        {isSelf ? (
          <Link to="/chat/settings" className="text-primary text-sm underline">تعديل بروفايلي</Link>
        ) : isBlocked ? (
          <Button variant="outline" onClick={handleUnblock} className="w-full">رفع الحظر</Button>
        ) : (
          <div className="space-y-2">
            <Button onClick={openChat} className="w-full"><MessageCircle className="w-4 h-4 ml-2" /> إرسال رسالة</Button>

            {incoming ? (
              <div className="flex gap-2">
                <Button onClick={handleAccept} className="flex-1" variant="default"><Check className="w-4 h-4 ml-1" />قبول الصداقة</Button>
                <Button onClick={handleReject} className="flex-1" variant="outline"><X className="w-4 h-4 ml-1" />رفض</Button>
              </div>
            ) : isFriend ? (
              <Button onClick={handleRemove} variant="outline" className="w-full"><UserMinus className="w-4 h-4 ml-2" />إزالة من الأصدقاء</Button>
            ) : outgoing ? (
              <Button disabled variant="outline" className="w-full">تم إرسال الطلب — بانتظار الرد</Button>
            ) : (
              <Button onClick={handleSendRequest} variant="outline" className="w-full"><UserPlus className="w-4 h-4 ml-2" />إضافة صديق</Button>
            )}

            <div className="flex gap-2">
              <Button onClick={handleBlock} variant="ghost" size="sm" className="flex-1 text-destructive"><Ban className="w-4 h-4 ml-1" />حظر</Button>
              <Button onClick={() => setReportOpen(true)} variant="ghost" size="sm" className="flex-1 text-destructive"><Flag className="w-4 h-4 ml-1" />إبلاغ</Button>
            </div>
          </div>
        )}
      </div>

      {!isSelf && (
        <ReportDialog
          open={reportOpen}
          onOpenChange={setReportOpen}
          reporterId={user!.id}
          targetUserId={profile.user_id}
          context="user"
        />
      )}
    </div>
  );
}
