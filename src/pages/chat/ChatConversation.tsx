// src/pages/chat/ChatConversation.tsx
import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAdFree } from "@/hooks/useAdFree";
import { isAdFreeActive } from "@/lib/chat/adFree";
import {
  fetchMessages,
  fetchMessagesBefore,
  sendMessage,
  editMessage,
  deleteMessageForMe,
  deleteMessageForEveryone,
  fetchReactions,
  markConversationRead,
  fetchPublicProfile,
  fetchPresenceForUsers,
  isOnline,
  DISAPPEARING_OPTIONS,
  setConversationDisappearing,
  dropExpiredMessages,
  type Message,
  type Reaction,
  type PublicProfile,
} from "@/lib/chat/queries";
import { checkSingleLine, MAX_LINE_CHARS } from "@/lib/chat/contentFilter";
import { noteChatMessageSent, showInterstitial } from "@/lib/adsMediation";
import MessageBubble from "@/components/chat/MessageBubble";
import UserAvatar from "@/components/chat/UserAvatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, ArrowRight, Ban, Flag, MoreVertical, X, Timer } from "lucide-react";
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
import ReportDialog from "@/components/chat/ReportDialog";
import { blockUser } from "@/lib/chat/queries";
import { typingChannel, sendTyping } from "@/lib/chat/typing";
import { toast } from "sonner";

export default function ChatConversation() {
  const { id: conversationId } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { isAdFree } = useAdFree();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [other, setOther] = useState<PublicProfile | null>(null);
  const [online, setOnline] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportMsgId, setReportMsgId] = useState<string | undefined>();
  const [otherTyping, setOtherTyping] = useState(false);
  // الرسالة اللي المستخدم بيرد عليها دلوقتي (بعد ما سحبها/شدها زي واتساب
  // أو ضغط على زرار "رد") — لو null يبقى مفيش رد جاري.
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  // كاش محلي للرسائل المقتبَسة اللي مش موجودة في نافذة الرسائل المحمّلة
  // حالياً (مثلاً لو المستخدم رد على رسالة قديمة قبل ما يعمل scroll لفوق)
  // عشان نقدر نعرض معاينة الاقتباس برضه.
  const [repliedCache, setRepliedCache] = useState<Record<string, Message>>({});
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const typingChannelRef = useRef<ReturnType<typeof typingChannel> | null>(null);
  const typingTimerRef = useRef<number | null>(null);
  const otherTypingTimerRef = useRef<number | null>(null);
  const lastTypingSentRef = useRef(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [disappearingSeconds, setDisappearingSecondsState] = useState<number | null>(null);

  useEffect(() => {
    if (!conversationId || !user) return;
    let active = true;

    const init = async () => {
      const { data: conv } = await supabase.from("conversations").select("*").eq("id", conversationId).maybeSingle();
      if (!conv || !active) return;
      setDisappearingSecondsState((conv as any).disappearing_seconds ?? null);
      const otherId = conv.user_a === user.id ? conv.user_b : conv.user_a;
      const [p, pres, msgs] = await Promise.all([
        fetchPublicProfile(otherId),
        fetchPresenceForUsers([otherId]),
        fetchMessages(conversationId),
      ]);
      if (!active) return;
      setOther(p);
      setOnline(isOnline((pres as any[])[0]));
      setMessages(msgs);
      const reacts = await fetchReactions(msgs.map((m) => m.id));
      setReactions(reacts);
      markConversationRead(conversationId, user.id);
    };
    init();

    const ch = supabase
      .channel(`conv:${conversationId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          setMessages((m) => (m.some((x) => x.id === (payload.new as any).id) ? m : [...m, payload.new as Message]));
          if ((payload.new as any).sender_id !== user.id) {
            markConversationRead(conversationId, user.id);
          }
        })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          setMessages((m) => m.map((x) => (x.id === (payload.new as any).id ? { ...x, ...(payload.new as any) } : x)));
        })
      .on("postgres_changes", { event: "*", schema: "public", table: "message_reactions" },
        async () => {
          const msgs = await fetchMessages(conversationId);
          const reacts = await fetchReactions(msgs.map((m) => m.id));
          setReactions(reacts);
        })
      .subscribe();

    const tc = typingChannel(conversationId);
    typingChannelRef.current = tc;
    tc.on("broadcast", { event: "typing" }, (msg) => {
      if ((msg.payload as any)?.userId === user.id) return;
      setOtherTyping(true);
      if (otherTypingTimerRef.current) window.clearTimeout(otherTypingTimerRef.current);
      otherTypingTimerRef.current = window.setTimeout(() => setOtherTyping(false), 3500);
    }).subscribe();

    return () => {
      active = false;
      supabase.removeChannel(ch);
      if (typingChannelRef.current) supabase.removeChannel(typingChannelRef.current);
      if (typingTimerRef.current) window.clearTimeout(typingTimerRef.current);
      if (otherTypingTimerRef.current) window.clearTimeout(otherTypingTimerRef.current);
    };
  }, [conversationId, user]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, otherTyping]);

  // لو في رسائل بترد على رسائل مش محمّلة في الـ state الحالي (خارج نافذة
  // الـ 50/30 رسالة اللي بنجيبها)، نجيبهم مرة واحدة عشان نعرض الاقتباس.
  useEffect(() => {
    const loadedIds = new Set(messages.map((m) => m.id));
    const missing = Array.from(
      new Set(
        messages
          .map((m) => m.reply_to_id)
          .filter((id): id is string => !!id && !loadedIds.has(id) && !repliedCache[id])
      )
    );
    if (missing.length === 0) return;
    let active = true;
    (async () => {
      const { data } = await supabase.from("messages").select("*").in("id", missing);
      if (!active || !data || data.length === 0) return;
      setRepliedCache((cur) => {
        const next = { ...cur };
        (data as Message[]).forEach((m) => { next[m.id] = m; });
        return next;
      });
    })();
    return () => { active = false; };
  }, [messages, repliedCache]);

  const getReplied = (id: string | null): Message | null => {
    if (!id) return null;
    return messages.find((m) => m.id === id) ?? repliedCache[id] ?? null;
  };

  const senderLabel = (m: Message) => (m.sender_id === user!.id ? "أنت" : other?.username ?? "");

  const loadOlder = async () => {
    if (!conversationId || loadingMore || !hasMore || messages.length === 0) return;
    setLoadingMore(true);
    const container = scrollRef.current;
    const prevHeight = container?.scrollHeight ?? 0;
    try {
      const older = await fetchMessagesBefore(conversationId, messages[0].created_at, 30);
      if (older.length === 0) {
        setHasMore(false);
      } else {
        setMessages((cur) => [...older, ...cur]);
        const olderReacts = await fetchReactions(older.map((m) => m.id));
        setReactions((cur) => [...cur, ...olderReacts]);
        requestAnimationFrame(() => {
          if (container) container.scrollTop = container.scrollHeight - prevHeight;
        });
      }
    } finally {
      setLoadingMore(false);
    }
  };

  const onScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (e.currentTarget.scrollTop < 60 && !loadingMore && hasMore) {
      loadOlder();
    }
  };

  const onTypingChange = (v: string) => {
    setText(v);
    const now = Date.now();
    if (typingChannelRef.current && user && v.length > 0 && now - lastTypingSentRef.current > 1200) {
      lastTypingSentRef.current = now;
      sendTyping(typingChannelRef.current, user.id).catch(() => {});
    }
  };

  const send = async () => {
    if (!text.trim() || !user || !conversationId || sending) return;

    const lineCheck = checkSingleLine(text.trim());
    if (!lineCheck.ok) {
      toast.error(lineCheck.reason!);
      return;
    }

    setSending(true);
    try {
      if (editingMessage) {
        const newBody = text.trim();
        await editMessage(editingMessage.id, newBody);
        setMessages((cur) =>
          cur.map((x) => (x.id === editingMessage.id ? { ...x, body: newBody, edited_at: new Date().toISOString() } : x))
        );
        setEditingMessage(null);
        setText("");
        return;
      }

      const m = await sendMessage(conversationId, user.id, text.trim(), replyTo?.id ?? null);
      setMessages((cur) => (cur.some((x) => x.id === m.id) ? cur : [...cur, m]));
      setText("");
      setReplyTo(null);

      if (noteChatMessageSent() && !isAdFree) {
        void showInterstitial("chat");
      }
    } catch (e: any) {
      toast.error(e?.message ?? "تعذر إرسال الرسالة");
    } finally {
      setSending(false);
    }
  };

  const startEdit = (m: Message) => {
    setReplyTo(null);
    setEditingMessage(m);
    setText(m.body);
  };

  const cancelEdit = () => {
    setEditingMessage(null);
    setText("");
  };

  const handleDeleteForMe = async (m: Message) => {
    if (!user) return;
    try {
      await deleteMessageForMe(m.id, user.id);
      setMessages((cur) =>
        cur.map((x) => (x.id === m.id ? { ...x, deleted_for: [...(x.deleted_for ?? []), user.id] } : x))
      );
    } catch (e: any) {
      toast.error(e?.message ?? "تعذر حذف الرسالة");
    }
  };

  const handleDeleteForEveryone = async (m: Message) => {
    try {
      await deleteMessageForEveryone(m.id);
      setMessages((cur) =>
        cur.map((x) => (x.id === m.id ? { ...x, deleted_at: new Date().toISOString(), body: "تم حذف هذه الرسالة" } : x))
      );
    } catch (e: any) {
      toast.error(e?.message ?? "تعذر حذف الرسالة");
    }
  };

  const handleBlock = async () => {
    if (!user || !other) return;
    try { await blockUser(user.id, other.user_id); toast.success("تم الحظر"); navigate("/chat"); }
    catch (e: any) { toast.error(e?.message ?? "فشل"); }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]" dir="rtl">
      <div className="sticky top-0 bg-card/95 backdrop-blur border-b border-border px-3 py-2 flex items-center gap-3 z-10">
        <button onClick={() => navigate("/chat")} className="text-primary"><ArrowRight className="w-5 h-5" /></button>
        {other && (
          <button onClick={() => navigate(`/chat/u/${other.username}`)} className="flex items-center gap-2 flex-1">
            <UserAvatar
              url={other.avatar_url}
              username={other.username}
              online={online}
              adFree={isAdFreeActive((other as any).ad_free_until)}
              size="sm"
            />
            <div className="text-right">
              <div className="font-horror text-primary text-sm">{other.username}</div>
              <div className="text-[10px] text-muted-foreground">
                {online ? "متصل الآن" : other.last_seen_at ? `آخر ظهور ${new Date(other.last_seen_at).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })}` : "غير متصل"}
              </div>
            </div>
          </button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="p-1 text-muted-foreground"><MoreVertical className="w-5 h-5" /></button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Timer className="w-4 h-4 ml-2" /> الرسائل المؤقتة
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuRadioGroup
                  value={disappearingSeconds === null ? "off" : String(disappearingSeconds)}
                  onValueChange={async (v) => {
                    if (!conversationId) return;
                    const seconds = v === "off" ? null : Number(v);
                    try {
                      await setConversationDisappearing(conversationId, seconds);
                      setDisappearingSecondsState(seconds);
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
            <DropdownMenuItem onClick={() => { setReportMsgId(undefined); setReportOpen(true); }}>
              <Flag className="w-4 h-4 ml-2" />الإبلاغ عن المستخدم
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleBlock} className="text-destructive">
              <Ban className="w-4 h-4 ml-2" />حظر المستخدم
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div ref={scrollRef} onScroll={onScroll} className="flex-1 overflow-y-auto p-3 space-y-2">
        {loadingMore && (
          <div className="text-center text-xs text-muted-foreground py-1">جاري تحميل الرسائل الأقدم…</div>
        )}
        {!hasMore && messages.length > 0 && (
          <div className="text-center text-[10px] text-muted-foreground/70 py-1">بداية المحادثة</div>
        )}
        {dropExpiredMessages(messages)
          .filter((m) => !m.deleted_for?.includes(user!.id))
          .map((m) => {
            const replied = getReplied(m.reply_to_id);
            return (
              <MessageBubble
                key={m.id}
                message={m}
                mine={m.sender_id === user!.id}
                reactions={reactions.filter((r) => r.message_id === m.id)}
                myUserId={user!.id}
                onReport={(msg) => { setReportMsgId(msg.id); setReportOpen(true); }}
                onReply={(msg) => { setEditingMessage(null); setReplyTo(msg); }}
                repliedMessage={replied}
                repliedSenderLabel={replied ? senderLabel(replied) : undefined}
                onEdit={startEdit}
                onDeleteForMe={handleDeleteForMe}
                onDeleteForEveryone={handleDeleteForEveryone}
              />
            );
          })}
        {otherTyping && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground font-typewriter animate-pulse">
            <span>{other?.username ?? "المستخدم"} يكتب</span>
            <span className="inline-flex gap-1">
              <span className="w-1 h-1 rounded-full bg-primary/70" />
              <span className="w-1 h-1 rounded-full bg-primary/70" />
              <span className="w-1 h-1 rounded-full bg-primary/70" />
            </span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-border p-2 bg-card">
        {editingMessage && (
          <div className="flex items-center gap-2 bg-muted/60 border-r-2 border-primary rounded-md px-3 py-1.5 mb-2">
            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold text-primary">تعديل الرسالة</div>
              <div className="text-xs text-muted-foreground truncate">{editingMessage.body}</div>
            </div>
            <button
              onClick={cancelEdit}
              className="p-1 text-muted-foreground hover:text-foreground shrink-0"
              aria-label="إلغاء التعديل"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        {replyTo && (
          <div className="flex items-center gap-2 bg-muted/60 border-r-2 border-primary rounded-md px-3 py-1.5 mb-2">
            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold text-primary">{senderLabel(replyTo)}</div>
              <div className="text-xs text-muted-foreground truncate">
                {replyTo.deleted_at ? "تم حذف الرسالة" : replyTo.body}
              </div>
            </div>
            <button
              onClick={() => setReplyTo(null)}
              className="p-1 text-muted-foreground hover:text-foreground shrink-0"
              aria-label="إلغاء الرد"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        <div className="flex gap-2 items-end">
          <Textarea
            value={text}
            onChange={(e) => onTypingChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder={editingMessage ? "عدّل الرسالة..." : "اكتب رسالة (سطر واحد)..."}
            rows={1}
            className="resize-none min-h-[40px] max-h-32"
            maxLength={MAX_LINE_CHARS}
          />
          <Button onClick={send} disabled={!text.trim() || sending} size="icon"><Send className="w-4 h-4" /></Button>
        </div>
        {text.length > MAX_LINE_CHARS - 20 && (
          <div className="text-[10px] text-muted-foreground text-left mt-1">{text.length}/{MAX_LINE_CHARS}</div>
        )}
      </div>

      {other && (
        <ReportDialog
          open={reportOpen}
          onOpenChange={setReportOpen}
          reporterId={user!.id}
          targetUserId={other.user_id}
          targetMessageId={reportMsgId}
          context={reportMsgId ? "message" : "user"}
        />
      )}
    </div>
  );
}
