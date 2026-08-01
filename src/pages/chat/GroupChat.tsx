import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useAdFree } from "@/hooks/useAdFree";
import { isAdFreeActive } from "@/lib/chat/adFree";
import { useGroupChat } from "@/hooks/useGroupChat";
import {
  sendGroupMessage,
  editGroupMessage,
  deleteGroupMessageForMe,
  leaveGroup,
  setGroupAdmin,
  banGroupMember,
  unbanGroupMember,
  removeGroupMember,
  regenerateGroupInvite,
  updateGroup,
  markGroupRead,
  deleteGroup,
  DISAPPEARING_OPTIONS,
  dropExpired,
  extractMentionedUserIds,
  insertGroupMessageMentions,
  createGroupPoll,
  fetchGroupPolls,
  voteOnPoll,
  softDeleteGroupMessage,
  pinGroupMessage,
  unpinGroupMessage,
  isPinActive,
  PIN_DURATION_OPTIONS,
  type GroupPoll,
  type GroupPollOption,
  type GroupPollVote,
} from "@/lib/chat/groupQueries";
import { fetchPublicProfilesByIds, canEditMessage, canDeleteForEveryone, type PublicProfile } from "@/lib/chat/queries";
import { renderMessageBody, isLocationBody, parseLocationBody, makeLocationBody } from "@/lib/chat/formatting";
import LocationMessage from "@/components/chat/LocationMessage";
import { checkSingleLine, filterMessage, MAX_LINE_CHARS } from "@/lib/chat/contentFilter";
import { noteChatMessageSent, showInterstitial } from "@/lib/adsMediation";
import { APP_WEB_ORIGIN } from "@/lib/appOrigin";
import { supabase } from "@/integrations/supabase/client";
import UserAvatar from "@/components/chat/UserAvatar";
import MediaComposerButtons from "@/components/chat/MediaComposerButtons";
import MediaMessageBubble from "@/components/chat/MediaMessageBubble";
import PollComposerDialog from "@/components/chat/PollComposerDialog";
import PollMessageBubble from "@/components/chat/PollMessageBubble";
import MentionAutocomplete from "@/components/chat/MentionAutocomplete";
import { sendGroupMediaMessage } from "@/lib/chat/mediaUpload";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
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
  Trash2,
  UserPlus,
  Timer,
  BarChart3,
  Pencil,
  X,
  Pin,
  PinOff,
  Flag,
} from "lucide-react";
import { toast } from "sonner";
import ReportDialog from "@/components/chat/ReportDialog";

// نصوص رسائل النظام (انضم/غادر/حُظر/اتشال) اللي بتتحط جوه الشات
// نفسها زي واتساب، بدل ما تكون فقاعة رسالة عادية

const SYSTEM_EVENT_LABEL: Record<string, (name: string) => string> = {
  joined: (name) => `${name} انضم إلى الجروب`,
  left: (name) => `${name} غادر الجروب`,
  banned: (name) => `${name} تم حظره من الجروب`,
  removed: (name) => `${name} تمت إزالته من الجروب`,
};

export default function GroupChat() {
  const { id: groupId } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { isAdFree } = useAdFree();
  const navigate = useNavigate();
  const { group, members, messages, loading, isMember, isBanned, isStaff, isOwner, canPost, setMessages } =
    useGroupChat(groupId);

  const [pinBusy, setPinBusy] = useState(false);
  const pinnedMessage =
    group && isPinActive(group) ? messages.find((m) => m.id === group.pinned_message_id) ?? null : null;

  const handlePin = async (messageId: string, hours: number | null) => {
    if (!groupId || pinBusy) return;
    setPinBusy(true);
    try {
      await pinGroupMessage(groupId, messageId, hours);
      toast.success("تم تثبيت الرسالة");
    } catch (e: any) {
      toast.error(e.message ?? "تعذر تثبيت الرسالة");
    } finally {
      setPinBusy(false);
    }
  };

  const handleUnpin = async () => {
    if (!groupId || pinBusy) return;
    setPinBusy(true);
    try {
      await unpinGroupMessage(groupId);
      toast.success("تم إلغاء التثبيت");
    } catch (e: any) {
      toast.error(e.message ?? "تعذر إلغاء التثبيت");
    } finally {
      setPinBusy(false);
    }
  };

  const [text, setText] = useState("");
  const [editingMessage, setEditingMessage] = useState<{ id: string; body: string } | null>(null);
  const [sending, setSending] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [membersTab, setMembersTab] = useState<"active" | "banned">("active");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [profiles, setProfiles] = useState<Map<string, PublicProfile>>(new Map());
  const bottomRef = useRef<HTMLDivElement>(null);

  // ----- استطلاعات الرأي (Polls) -----
  const [pollOpen, setPollOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState<{ userId: string; messageId: string } | null>(null);
  const [polls, setPolls] = useState<Map<string, GroupPoll>>(new Map()); // key = message_id
  const [pollOptions, setPollOptions] = useState<Map<string, GroupPollOption[]>>(new Map()); // key = poll_id
  const [pollVotes, setPollVotes] = useState<Map<string, GroupPollVote[]>>(new Map()); // key = poll_id

  // ----- منشن @username -----
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  useEffect(() => {
    if (!user || !groupId) return;
    markGroupRead(groupId);
  }, [user, groupId, messages.length]);

  useEffect(() => {
    if (members.length === 0) return;
    fetchPublicProfilesByIds(members.map((m) => m.user_id)).then((profs) => {
      setProfiles(new Map(profs.map((p) => [p.user_id, p])));
    });
  }, [members]);

  // تحميل الاستطلاعات الحالية للجروب + متابعتها لحظياً (تصويت جديد/استطلاع جديد)
  useEffect(() => {
    if (!groupId) return;
    let active = true;

    const load = async () => {
      const { polls: pollList, options, votes } = await fetchGroupPolls(groupId);
      if (!active) return;
      setPolls(new Map(pollList.filter((p) => p.message_id).map((p) => [p.message_id as string, p])));
      const optMap = new Map<string, GroupPollOption[]>();
      options.forEach((o) => optMap.set(o.poll_id, [...(optMap.get(o.poll_id) ?? []), o]));
      setPollOptions(optMap);
      const voteMap = new Map<string, GroupPollVote[]>();
      votes.forEach((v) => voteMap.set(v.poll_id, [...(voteMap.get(v.poll_id) ?? []), v]));
      setPollVotes(voteMap);
    };
    load();

    const ch = supabase
      .channel(`group-polls:${groupId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "group_polls", filter: `group_id=eq.${groupId}` }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "group_poll_options" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "group_poll_votes" }, () => load())
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(ch);
    };
  }, [groupId]);

  const send = async () => {
    if (!text.trim() || !user || !groupId || sending) return;

    const lineCheck = checkSingleLine(text.trim());
    if (!lineCheck.ok) {
      toast.error(lineCheck.reason!);
      return;
    }

    setSending(true);
    try {
      if (editingMessage) {
        const newBody = filterMessage(text.trim());
        await editGroupMessage(editingMessage.id, newBody);
        setMessages((cur) =>
          cur.map((x) => (x.id === editingMessage.id ? { ...x, body: newBody, edited_at: new Date().toISOString() } : x))
        );
        setEditingMessage(null);
        setText("");
        return;
      }

      const cleanBody = filterMessage(text.trim());
      const m = await sendGroupMessage(groupId, user.id, cleanBody);
      setMessages((cur) => (cur.some((x) => x.id === m.id) ? cur : [...cur, m]));
      setText("");
      setMentionQuery(null);

      const mentioned = extractMentionedUserIds(
        cleanBody,
        activeMembers.filter((mem) => mem.user_id !== user.id).map((mem) => ({ user_id: mem.user_id, username: profiles.get(mem.user_id)?.username ?? null }))
      );
      if (mentioned.length > 0) {
        void insertGroupMessageMentions(m.id, mentioned);
      }

      if (noteChatMessageSent() && !isAdFree) {
        void showInterstitial("chat");
      }
    } catch (e: any) {
      toast.error(e?.message ?? "تعذر إرسال الرسالة");
    } finally {
      setSending(false);
    }
  };

  const startEdit = (m: { id: string; body: string | null }) => {
    if (!m.body) return;
    setEditingMessage({ id: m.id, body: m.body });
    setText(m.body);
  };

  const cancelEdit = () => {
    setEditingMessage(null);
    setText("");
  };

  const handleDeleteForMe = async (messageId: string) => {
    if (!user) return;
    try {
      await deleteGroupMessageForMe(messageId, user.id);
      setMessages((cur) =>
        cur.map((x) => (x.id === messageId ? { ...x, deleted_for: [...(x.deleted_for ?? []), user.id] } : x))
      );
    } catch (e: any) {
      toast.error(e?.message ?? "تعذر حذف الرسالة");
    }
  };

  const handleDeleteForEveryone = async (messageId: string) => {
    try {
      await softDeleteGroupMessage(messageId);
      setMessages((cur) => (cur.map((x) => (x.id === messageId ? { ...x, deleted_at: new Date().toISOString() } : x))));
    } catch (e: any) {
      toast.error(e?.message ?? "تعذر حذف الرسالة");
    }
  };

  // كتابة نص جديد جوه الـ Textarea — لو آخر حاجة اليوزر كاتبها هي "@..."
  // نظهر قائمة الأعضاء المطابقين عشان يختار منهم (Autocomplete)
  const onTextChange = (v: string) => {
    setText(v);
    const match = v.match(/(?:^|\s)@([A-Za-z0-9_\u0600-\u06FF]*)$/);
    setMentionQuery(match ? match[1] : null);
  };

  const pickMention = (username: string) => {
    if (!username) return;
    setText((cur) => cur.replace(/(?:^|\s)@([A-Za-z0-9_\u0600-\u06FF]*)$/, (full) => {
      const prefix = full.startsWith(" ") ? " " : "";
      return `${prefix}@${username} `;
    }));
    setMentionQuery(null);
  };

  const handleCreatePoll = async (question: string, options: string[], allowMultiple: boolean) => {
    if (!user || !groupId) return;
    const { message } = await createGroupPoll(groupId, user.id, question, options, allowMultiple);
    setMessages((cur) => (cur.some((x) => x.id === message.id) ? cur : [...cur, message]));
  };

  const handleVote = async (pollId: string, optionId: string, allowMultiple: boolean) => {
    if (!user) return;
    try {
      await voteOnPoll(pollId, optionId, user.id, allowMultiple);
    } catch (e: any) {
      toast.error(e?.message ?? "تعذر التصويت");
    }
  };

  const handlePickFile = async (file: File, viewOnce: boolean) => {
    if (!user || !groupId) return;
    try {
      const m = await sendGroupMediaMessage(groupId, user.id, file, file.type, { viewOnce });
      setMessages((cur) => (cur.some((x) => x.id === (m as any).id) ? cur : [...cur, m as any]));
      if (noteChatMessageSent() && !isAdFree) {
        void showInterstitial("chat");
      }
    } catch (e: any) {
      toast.error(e?.message ?? "تعذر إرسال الملف");
    }
  };

  const handleRecordedAudio = async (blob: Blob, mime: string, durationSeconds: number) => {
    if (!user || !groupId) return;
    try {
      const m = await sendGroupMediaMessage(groupId, user.id, blob, mime, { durationSeconds });
      setMessages((cur) => (cur.some((x) => x.id === (m as any).id) ? cur : [...cur, m as any]));
    } catch (e: any) {
      toast.error(e?.message ?? "تعذر إرسال الرسالة الصوتية");
    }
  };

  const handleShareLocation = async () => {
    if (!user || !groupId) return;
    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000 });
    }).catch(() => null);
    if (!position) {
      toast.error("تعذر الوصول للموقع — تأكد من إذن الموقع");
      return;
    }
    const body = makeLocationBody(position.coords.latitude, position.coords.longitude);
    const m = await sendGroupMessage(groupId, user.id, body);
    setMessages((cur) => (cur.some((x) => x.id === m.id) ? cur : [...cur, m]));
  };

  const copyInvite = async () => {
    if (!group) return;
    const link = `${APP_WEB_ORIGIN}/chat/groups/join/${group.invite_code}`;
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

  const handleUnban = async (targetUser: string) => {
    if (!groupId) return;
    try {
      await unbanGroupMember(groupId, targetUser);
      toast.success("تم فك الحظر");
    } catch (e: any) {
      toast.error(e?.message ?? "فشل فك الحظر");
    }
  };

  const handleDeleteGroup = async () => {
    if (!groupId || deleting) return;
    setDeleting(true);
    try {
      await deleteGroup(groupId);
      toast.success("تم حذف الجروب");
      navigate("/chat/groups", { replace: true });
    } catch (e: any) {
      toast.error(e?.message ?? "تعذر حذف الجروب");
      setDeleting(false);
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
  const bannedMembers = members.filter((m) => m.status === "banned");

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
        {isOwner && (
          <button
            onClick={() => setDeleteOpen(true)}
            className="p-1 text-destructive"
            title="حذف الجروب"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        )}
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
            {isStaff && (
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <Timer className="w-4 h-4 ml-2" /> الرسائل المؤقتة
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuRadioGroup
                    value={String(group.disappearing_seconds ?? "off")}
                    onValueChange={async (v) => {
                      const seconds = v === "off" ? null : Number(v);
                      try {
                        await updateGroup(groupId!, { disappearing_seconds: seconds });
                        toast.success("تم تحديث إعداد الرسائل المؤقتة");
                      } catch (e: any) {
                        toast.error(e?.message ?? "تعذر تحديث الإعداد");
                      }
                    }}
                  >
                    {DISAPPEARING_OPTIONS.map((opt) => (
                      <DropdownMenuRadioItem key={opt.label} value={opt.seconds === null ? "off" : String(opt.seconds)}>
                        {opt.label}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            )}
            <DropdownMenuItem onClick={handleLeave} className="text-destructive">
              <LogOut className="w-4 h-4 ml-2" /> مغادرة الجروب
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {pinnedMessage && (
        <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-3 py-2">
          <Pin className="w-4 h-4 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-[10px] text-primary font-bold">رسالة مثبتة</div>
            <div className="text-xs text-muted-foreground truncate">
              {pinnedMessage.body ? (isLocationBody(pinnedMessage.body) ? "📍 موقع مُشارك" : renderMessageBody(pinnedMessage.body)) : "📎 وسائط"}
            </div>
          </div>
          {isStaff && (
            <button
              onClick={handleUnpin}
              disabled={pinBusy}
              className="p-1 text-muted-foreground hover:text-destructive shrink-0"
              aria-label="إلغاء التثبيت"
            >
              <PinOff className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {messages.length === 0 && (
          <p className="text-center text-sm text-muted-foreground font-typewriter py-10">
            لا توجد رسائل بعد — ابدأ المحادثة!
          </p>
        )}
        {dropExpired(messages)
          .filter((m) => !m.deleted_for?.includes(user!.id))
          .map((m) => {
          const sender = profiles.get(m.sender_id);

          if (m.system_event) {
            const label = SYSTEM_EVENT_LABEL[m.system_event]?.(sender?.username ?? "عضو") ?? "";
            return (
              <div key={m.id} className="flex justify-center py-1">
                <span className="text-[11px] text-muted-foreground bg-muted/50 rounded-full px-3 py-1 font-typewriter">
                  {label}
                </span>
              </div>
            );
          }

          const mine = m.sender_id === user!.id;
          const poll = polls.get(m.id);
          const isTextMessage = !poll && !m.media_type;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"} gap-2 group`}>
              {!mine && (
                <UserAvatar
                  url={sender?.avatar_url}
                  username={sender?.username}
                  adFree={isAdFreeActive((sender as any)?.ad_free_until)}
                  size="sm"
                />
              )}
              <div
                className={`max-w-[75%] relative rounded-lg px-3 py-2 backdrop-blur-md border text-white ${
                  mine ? "bg-primary/25 border-primary/40" : "bg-white/10 border-white/20"
                }`}
              >
                {!mine && <div className="text-[10px] text-primary font-horror mb-0.5">{sender?.username ?? "..."}</div>}
                {poll ? (
                  <PollMessageBubble
                    poll={poll}
                    options={pollOptions.get(poll.id) ?? []}
                    votes={pollVotes.get(poll.id) ?? []}
                    myUserId={user!.id}
                    mine={mine}
                    onVote={(optionId) => handleVote(poll.id, optionId, poll.allow_multiple)}
                  />
                ) : m.media_type ? (
                  <MediaMessageBubble
                    messageId={m.id}
                    kind="group"
                    mediaType={m.media_type}
                    mediaPath={m.media_path}
                    mediaMime={m.media_mime}
                    mediaIv={m.media_iv}
                    mediaKey={m.media_key}
                    mediaDeletedAt={m.media_deleted_at}
                    durationSeconds={m.media_duration_seconds}
                    mine={mine}
                    viewOnce={m.view_once}
                    viewedAt={m.viewed_at}
                  />
                ) : m.deleted_at ? (
                  <p className="text-sm italic opacity-70">تم حذف هذه الرسالة</p>
                ) : (
                  m.body && (
                    isLocationBody(m.body) ? (
                      (() => {
                        const loc = parseLocationBody(m.body);
                        return loc ? <LocationMessage lat={loc.lat} lng={loc.lng} /> : null;
                      })()
                    ) : (
                      <p className="text-sm whitespace-pre-wrap break-words">{renderMessageBody(m.body)}</p>
                    )
                  )
                )}
                {!poll && (
                  <div className="text-[9px] opacity-70 mt-1 flex items-center gap-1 justify-end">
                    {m.edited_at && !m.deleted_at && <span>معدَّلة</span>}
                    <span>{new Date(m.created_at).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                )}
                {isTextMessage && !m.deleted_at && (
                  <div
                    className={`absolute top-1 opacity-0 group-hover:opacity-100 transition-opacity ${mine ? "left-1" : "right-1"}`}
                  >
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="p-0.5 rounded-full bg-black/10 hover:bg-black/20">
                          <MoreVertical className="w-3 h-3" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start">
                        {mine && m.body && canEditMessage(m) && (
                          <DropdownMenuItem onClick={() => startEdit({ id: m.id, body: m.body })}>
                            <Pencil className="w-3 h-3 ml-2" />
                            تعديل
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => handleDeleteForMe(m.id)}>
                          <Trash2 className="w-3 h-3 ml-2" />
                          حذف من عندي
                        </DropdownMenuItem>
                        {mine && canDeleteForEveryone(m) && (
                          <DropdownMenuItem onClick={() => handleDeleteForEveryone(m.id)} className="text-destructive">
                            <Trash2 className="w-3 h-3 ml-2" />
                            حذف لدى الجميع
                          </DropdownMenuItem>
                        )}
                        {!mine && (
                          <DropdownMenuItem
                            onClick={() => setReportTarget({ userId: m.sender_id, messageId: m.id })}
                            className="text-destructive"
                          >
                            <Flag className="w-3 h-3 ml-2" />
                            الإبلاغ عن الرسالة
                          </DropdownMenuItem>
                        )}
                        {isStaff && (
                          <DropdownMenuSub>
                            <DropdownMenuSubTrigger>
                              <Pin className="w-3 h-3 ml-2" />
                              تثبيت الرسالة
                            </DropdownMenuSubTrigger>
                            <DropdownMenuSubContent>
                              {PIN_DURATION_OPTIONS.map((opt) => (
                                <DropdownMenuItem key={opt.label} onClick={() => handlePin(m.id, opt.hours)}>
                                  {opt.label}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuSubContent>
                          </DropdownMenuSub>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-border p-2 bg-card">
        {editingMessage && (
          <div className="flex items-center gap-2 bg-muted/60 border-r-2 border-primary rounded-md px-3 py-1.5 mb-2">
            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold text-primary">تعديل الرسالة</div>
              <div className="text-xs text-muted-foreground truncate">{editingMessage.body}</div>
            </div>
            <button onClick={cancelEdit} className="p-1 text-muted-foreground hover:text-foreground shrink-0" aria-label="إلغاء التعديل">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        {canPost ? (
          <>
            {mentionQuery !== null && (
              <MentionAutocomplete
                candidates={activeMembers
                  .filter((mem) => mem.user_id !== user!.id)
                  .map((mem) => profiles.get(mem.user_id))
                  .filter((p): p is PublicProfile => !!p?.username && p.username.toLowerCase().startsWith(mentionQuery.toLowerCase()))
                  .slice(0, 6)}
                onPick={pickMention}
              />
            )}
            <div className="flex gap-2 items-end">
              <MediaComposerButtons
                disabled={sending}
                onPickFile={handlePickFile}
                onRecordedAudio={handleRecordedAudio}
                onShareLocation={handleShareLocation}
              />
              <button
                type="button"
                onClick={() => setPollOpen(true)}
                disabled={sending}
                className="p-2 text-muted-foreground hover:text-primary shrink-0"
                title="إنشاء استطلاع رأي"
              >
                <BarChart3 className="w-5 h-5" />
              </button>
              <Textarea
                value={text}
                onChange={(e) => onTextChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder={editingMessage ? "عدّل الرسالة..." : "اكتب رسالة (سطر واحد)..."}
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

      <Dialog
        open={membersOpen}
        onOpenChange={(o) => {
          setMembersOpen(o);
          if (!o) setMembersTab("active");
        }}
      >
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>أعضاء الجروب</DialogTitle>
          </DialogHeader>

          {isStaff ? (
            <Tabs value={membersTab} onValueChange={(v) => setMembersTab(v as "active" | "banned")}>
              <TabsList className="w-full">
                <TabsTrigger value="active" className="flex-1">
                  الأعضاء ({activeMembers.length}/{group?.max_members ?? 1024})
                </TabsTrigger>
                <TabsTrigger value="banned" className="flex-1">
                  المحظورون ({bannedMembers.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="active" className="max-h-96 overflow-y-auto space-y-2 mt-2">
                {activeMembers.map((m) => (
                  <ActiveMemberRow
                    key={m.user_id}
                    member={m}
                    profile={profiles.get(m.user_id)}
                    isSelf={m.user_id === user!.id}
                    isStaff={isStaff}
                    isOwner={isOwner}
                    onPromote={handlePromote}
                    onRemove={handleRemove}
                    onBan={handleBan}
                  />
                ))}
              </TabsContent>

              <TabsContent value="banned" className="max-h-96 overflow-y-auto space-y-2 mt-2">
                {bannedMembers.length === 0 ? (
                  <p className="text-sm text-muted-foreground font-typewriter text-center py-6">
                    لا يوجد محظورون في هذا الجروب
                  </p>
                ) : (
                  bannedMembers.map((m) => {
                    const p = profiles.get(m.user_id);
                    return (
                      <div key={m.user_id} className="flex items-center gap-2 p-2 rounded-lg border border-border">
                        <UserAvatar url={p?.avatar_url} username={p?.username} size="sm" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-typewriter truncate">{p?.username ?? "..."}</div>
                          <div className="text-[10px] text-destructive">محظور من الجروب</div>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => handleUnban(m.user_id)}>
                          <UserPlus className="w-4 h-4 ml-1" /> فك الحظر
                        </Button>
                      </div>
                    );
                  })
                )}
              </TabsContent>
            </Tabs>
          ) : (
            <div className="max-h-96 overflow-y-auto space-y-2">
              {activeMembers.map((m) => (
                <ActiveMemberRow
                  key={m.user_id}
                  member={m}
                  profile={profiles.get(m.user_id)}
                  isSelf={m.user_id === user!.id}
                  isStaff={isStaff}
                  isOwner={isOwner}
                  onPromote={handlePromote}
                  onRemove={handleRemove}
                  onBan={handleBan}
                />
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <PollComposerDialog open={pollOpen} onOpenChange={setPollOpen} onCreate={handleCreatePoll} />

      {reportTarget && (
        <ReportDialog
          open={!!reportTarget}
          onOpenChange={(v) => !v && setReportTarget(null)}
          reporterId={user!.id}
          targetUserId={reportTarget.userId}
          targetMessageId={reportTarget.messageId}
          context="message"
          groupId={groupId}
        />
      )}

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>حذف الجروب</AlertDialogTitle>
            <AlertDialogDescription>
              هل انت متأكد من حذف جروب "{group.name}"؟ هذا الإجراء نهائي ولا يمكن التراجع عنه، وهيتم حذف كل الرسائل والأعضاء.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="sm:justify-start gap-2">
            <AlertDialogAction
              disabled={deleting}
              onClick={(e) => {
                e.preventDefault();
                handleDeleteGroup();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : null}
              نعم، احذف الجروب
            </AlertDialogAction>
            <AlertDialogCancel className="bg-green-600 text-white hover:bg-green-700 border-green-600">
              لا
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// صف عضو نشط واحد جوه ديالوج الأعضاء — بتترسم مرتين (تاب الأعضاء
// للمشرفين، وقائمة الأعضاء العادية للباقي) فمن الأحسن نستخرجها هنا
function ActiveMemberRow({
  member,
  profile,
  isSelf,
  isStaff,
  isOwner,
  onPromote,
  onRemove,
  onBan,
}: {
  member: { user_id: string; role: string };
  profile?: PublicProfile;
  isSelf: boolean;
  isStaff: boolean;
  isOwner: boolean;
  onPromote: (targetUser: string, makeAdmin: boolean) => void;
  onRemove: (targetUser: string) => void;
  onBan: (targetUser: string) => void;
}) {
  const p = profile;
  return (
    <div className="flex items-center gap-2 p-2 rounded-lg border border-border">
      <UserAvatar
        url={p?.avatar_url}
        username={p?.username}
        adFree={isAdFreeActive((p as any)?.ad_free_until)}
        size="sm"
      />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-typewriter truncate">{p?.username ?? "..."}</div>
        <div className="text-[10px] text-muted-foreground">
          {member.role === "owner" ? "مالك الجروب" : member.role === "admin" ? "مشرف" : "عضو"}
        </div>
      </div>
      {isStaff && !isSelf && member.role !== "owner" && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="p-1 text-muted-foreground">
              <MoreVertical className="w-4 h-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {isOwner && (
              <DropdownMenuItem onClick={() => onPromote(member.user_id, member.role !== "admin")}>
                <ShieldCheck className="w-4 h-4 ml-2" />
                {member.role === "admin" ? "إلغاء الإشراف" : "ترقية لمشرف"}
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => onRemove(member.user_id)}>
              <UserMinus className="w-4 h-4 ml-2" /> إزالة من الجروب
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onBan(member.user_id)} className="text-destructive">
              <Ban className="w-4 h-4 ml-2" /> حظر
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
                    }
