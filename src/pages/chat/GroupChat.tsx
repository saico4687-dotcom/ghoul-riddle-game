import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useAdFree } from "@/hooks/useAdFree";
import { isAdFreeActive } from "@/lib/chat/adFree";
import { useGroupChat } from "@/hooks/useGroupChat";
import {
  sendGroupMessage,
  leaveGroup,
  setGroupAdmin,
  banGroupMember,
  removeGroupMember,
  regenerateGroupInvite,
  updateGroup,
} from "@/lib/chat/groupQueries";
import { fetchPublicProfilesByIds, type PublicProfile } from "@/lib/chat/queries";
import { checkSingleLine, MAX_LINE_CHARS } from "@/lib/chat/contentFilter";
import { noteChatMessageSent, showInterstitial } from "@/lib/adsMediation";
import UserAvatar from "@/components/chat/UserAvatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Send,
  ArrowRight,
  Users,
  MoreVertical,
  Link2,
  Lock,
  LockOpen,
  LogOut,
  ShieldCheck,
  Ban,
  UserMinus,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

export default function GroupChat() {
  const { id: groupId } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { isAdFree } = useAdFree();
  const navigate = useNavigate();
  const { group, members, messages, loading, isMember, isBanned, isStaff, isOwner, canPost, setMessages } =
    useGroupChat(groupId);

  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [profiles, setProfiles] = useState<Map<string, PublicProfile>>(new Map());
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  useEffect(() => {
    if (members.length === 0) return;
    fetchPublicProfilesByIds(members.map((m) => m.user_id)).then((profs) => {
      setProfiles(new Map(profs.map((p) => [p.user_id, p])));
    });
  }, [members]);

  const send = async () => {
    if (!text.trim() || !user || !groupId || sending) return;

    // حد "سطر واحد" للرسالة — لو خالفت الشرط بيظهر تنبيه ومتتبعتش
    // الرسالة للسيرفر أصلاً.
    const lineCheck = checkSingleLine(text.trim());
    if (!lineCheck.ok) {
      toast.error(lineCheck.reason!);
      return;
    }

    setSending(true);
    try {
      const m = await sendGroupMessage(groupId, user.id, text.trim());
      setMessages((cur) => (cur.some((x) => x.id === m.id) ? cur : [...cur, m]));
      setText("");

      // إعلان فاصل كل 10 رسائل (خاص أو جروب) — إلا لو عنده دردشة
      // بدون إعلانات نشطة حالياً.
      if (noteChatMessageSent() && !isAdFree) {
        void showInterstitial("chat");
      }
    } catch (e: any) {
      toast.error(e?.message ?? "تعذر إرسال الرسالة");
    } finally {
      setSending(false);
    }
  };

  const copyInvite = async () => {
    if (!group) return;
    const link = `${window.location.origin}/chat/groups/join/${group.invite_code}`;
    try {
      await navigator.clipboard.writeText(link);
      toast.success("تم نسخ رابط الدعوة");
    } catch {
      toast.error("تعذر نسخ الرابط");
    }
  };

  const regenerateInvite = async () => {
    if (!groupId) return;
    try {
      await regenerateGroupInvite(groupId);
      toast.success("تم تجديد رابط الدعوة");
    } catch (e: any) {
      toast.error(e?.message ?? "فشل تجديد الرابط");
    }
  };

  const toggleLock = async () => {
    if (!groupId || !group) return;
    try {
      await updateGroup(groupId, { lock_chat: !group.lock_chat });
    } catch (e: any) {
      toast.error(e?.message ?? "فشل تغيير حالة القفل");
    }
  };

  const handleLeave = async () => {
    if (!groupId) return;
    try {
      await leaveGroup(groupId);
      toast.success("تم مغادرة الجروب");
      navigate("/chat/groups", { replace: true });
    } catch (e: any) {
      toast.error(e?.message ?? "تعذر مغادرة الجروب");
    }
  };

  const handlePromote = async (targetUser: string, makeAdmin: boolean) => {
    if (!groupId) return;
    try {
      await setGroupAdmin(groupId, targetUser, makeAdmin);
      toast.success(makeAdmin ? "تمت الترقية لمشرف" : "تم إلغاء صلاحية الإشراف");
    } catch (e: any) {
      toast.error(e?.message ?? "فشلت العملية");
    }
  };

  const handleBan = async (targetUser: string) => {
    if (!groupId) return;
    try {
      await banGroupMember(groupId, targetUser);
      toast.success("تم حظر العضو");
    } catch (e: any) {
      toast.error(e?.message ?? "فشل الحظر");
    }
  };

  const handleRemove = async (targetUser: string) => {
    if (!groupId) return;
    try {
      await removeGroupMember(groupId, targetUser);
      toast.success("تمت إزالة العضو");
    } catch (e: any) {
      toast.error(e?.message ?? "فشلت الإزالة");
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center pt-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!group) {
    return (
      <div className="p-6 text-center" dir="rtl">
        <p className="text-muted-foreground font-typewriter mb-4">الجروب غير موجود</p>
        <Button onClick={() => navigate("/chat/groups")}>رجوع للجروبات</Button>
      </div>
    );
  }

  if (isBanned) {
    return (
      <div className="p-6 text-center" dir="rtl">
        <p className="text-destructive font-horror mb-2">أنت محظور من هذا الجروب</p>
        <Button onClick={() => navigate("/chat/groups")}>رجوع للجروبات</Button>
      </div>
    );
  }

  if (!isMember) {
    return (
      <div className="p-6 text-center space-y-4" dir="rtl">
        <p className="text-muted-foreground font-typewriter">لست عضواً في هذا الجروب</p>
        <Button onClick={() => navigate(`/chat/groups/join/${group.invite_code}`)}>الانضمام للجروب</Button>
      </div>
    );
  }

  const activeMembers = members.filter((m) => m.status === "active");

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]" dir="rtl">
      <div className="sticky top-0 bg-card/95 backdrop-blur border-b border-border px-3 py-2 flex items-center gap-3 z-10">
        <button onClick={() => navigate("/chat/groups")} className="text-primary">
          <ArrowRight className="w-5 h-5" />
        </button>
        <button onClick={() => setMembersOpen(true)} className="flex items-center gap-2 flex-1 min-w-0">
          <UserAvatar url={group.avatar_url} username={group.name} size="sm" />
          <div className="text-right min-w-0">
            <div className="font-horror text-primary text-sm truncate">{group.name}</div>
            <div className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Users className="w-3 h-3" /> {activeMembers.length} عضو
              {group.lock_chat && <Lock className="w-3 h-3 mr-1" />}
            </div>
          </div>
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="p-1 text-muted-foreground">
              <MoreVertical className="w-5 h-5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => setMembersOpen(true)}>
              <Users className="w-4 h-4 ml-2" /> الأعضاء
            </DropdownMenuItem>
            {isStaff && (
              <DropdownMenuItem onClick={copyInvite}>
                <Link2 className="w-4 h-4 ml-2" /> نسخ رابط الدعوة
              </DropdownMenuItem>
            )}
            {isOwner && (
              <DropdownMenuItem onClick={regenerateInvite}>
                <RefreshCw className="w-4 h-4 ml-2" /> تجديد رابط الدعوة
              </DropdownMenuItem>
            )}
            {isStaff && (
              <DropdownMenuItem onClick={toggleLock}>
                {group.lock_chat ? <LockOpen className="w-4 h-4 ml-2" /> : <Lock className="w-4 h-4 ml-2" />}
                {group.lock_chat ? "فتح الدردشة للجميع" : "قفل الدردشة (مشرفين فقط)"}
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={handleLeave} className="text-destructive">
              <LogOut className="w-4 h-4 ml-2" /> مغادرة الجروب
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {messages.length === 0 && (
          <p className="text-center text-sm text-muted-foreground font-typewriter py-10">
            لا توجد رسائل بعد — ابدأ المحادثة!
          </p>
        )}
        {messages.map((m) => {
          const sender = profiles.get(m.sender_id);
          const mine = m.sender_id === user!.id;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"} gap-2`}>
              {!mine && (
                <UserAvatar
                  url={sender?.avatar_url}
                  username={sender?.username}
                  adFree={isAdFreeActive((sender as any)?.ad_free_until)}
                  size="sm"
                />
              )}
              <div
                className={`max-w-[75%] rounded-lg px-3 py-2 ${
                  mine ? "bg-primary text-primary-foreground" : "bg-card border border-border"
                }`}
              >
                {!mine && <div className="text-[10px] text-primary font-horror mb-0.5">{sender?.username ?? "..."}</div>}
                {m.body && <p className="text-sm whitespace-pre-wrap break-words">{m.body}</p>}
                <div className="text-[9px] opacity-70 mt-1 text-left">
                  {new Date(m.created_at).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-border p-2 bg-card">
        {canPost ? (
          <>
            <div className="flex gap-2 items-end">
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder="اكتب رسالة (سطر واحد)..."
                rows={1}
                className="resize-none min-h-[40px] max-h-32"
                maxLength={MAX_LINE_CHARS}
              />
              <Button onClick={send} disabled={!text.trim() || sending} size="icon">
                <Send className="w-4 h-4" />
              </Button>
            </div>
            {text.length > MAX_LINE_CHARS - 20 && (
              <div className="text-[10px] text-muted-foreground text-left mt-1">{text.length}/{MAX_LINE_CHARS}</div>
            )}
          </>
        ) : (
          <p className="text-xs text-muted-foreground font-typewriter w-full text-center py-2">
            الدردشة مقفولة حالياً — المشرفون فقط يقدروا يكتبوا
          </p>
        )}
      </div>

      <Dialog open={membersOpen} onOpenChange={setMembersOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>أعضاء الجروب ({activeMembers.length})</DialogTitle>
          </DialogHeader>
          <div className="max-h-96 overflow-y-auto space-y-2">
            {activeMembers.map((m) => {
              const p = profiles.get(m.user_id);
              const isSelf = m.user_id === user!.id;
              return (
                <div key={m.user_id} className="flex items-center gap-2 p-2 rounded-lg border border-border">
                  <UserAvatar
                    url={p?.avatar_url}
                    username={p?.username}
                    adFree={isAdFreeActive((p as any)?.ad_free_until)}
                    size="sm"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-typewriter truncate">{p?.username ?? "..."}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {m.role === "owner" ? "مالك الجروب" : m.role === "admin" ? "مشرف" : "عضو"}
                    </div>
                  </div>
                  {isStaff && !isSelf && m.role !== "owner" && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="p-1 text-muted-foreground">
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start">
                        {isOwner && (
                          <DropdownMenuItem onClick={() => handlePromote(m.user_id, m.role !== "admin")}>
                            <ShieldCheck className="w-4 h-4 ml-2" />
                            {m.role === "admin" ? "إلغاء الإشراف" : "ترقية لمشرف"}
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => handleRemove(m.user_id)}>
                          <UserMinus className="w-4 h-4 ml-2" /> إزالة من الجروب
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleBan(m.user_id)} className="text-destructive">
                          <Ban className="w-4 h-4 ml-2" /> حظر
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
    }
