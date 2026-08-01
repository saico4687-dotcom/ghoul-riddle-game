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
import { makeLocationBody } from "@/lib/chat/formatting";
import { ensureLocalKeyPair, deriveSharedKey, encryptBody, decryptBody } from "@/lib/chat/e2e";
import MessageBubble from "@/components/chat/MessageBubble";
import UserAvatar from "@/components/chat/UserAvatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, ArrowRight, Ban, Flag, MoreVertical, X, Timer, MapPin, Loader2 as LoaderIcon } from "lucide-react";
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
  const [sharingLocation, setSharingLocation] = useState(false);
  // مفتاحي الخاص (ECDH) على الجهاز، والمفتاح المشترك المشتق مع الطرف
  // التاني في المحادثة دي — راجع src/lib/chat/e2e.ts. لو الطرف التاني
  // لسه معندوش مفتاح عام مرفوع (أول مرة يفتح فيها الشات)، sharedKeyRef
  // بتفضل null والرسائل بتتبعت نص عادي مؤقتًا.
  const myPrivateKeyRef = useRef<CryptoKey | null>(null);
  const sharedKeyRef = useRef<CryptoKey | null>(null);

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

      try {
        const myPriv = await ensureLocalKeyPair(user.id);
        myPrivateKeyRef.current = myPriv;
        if (p?.public_key) {
          sharedKeyRef.current = await deriveSharedKey(myPriv, p.public_key, conversationId);
        }
      } catch {
        // فشل إعداد التشفير مايوقفش الشات — هيفضل يشتغل بنص عادي
      }

      const decryptedMsgs = await Promise.all(
        msgs.map(async (m) => ({ ...m, body: await decryptBody(sharedKeyRef.current, m.body) }))
      );
      if (!active) return;
      setMessages(decryptedMsgs);
      const reacts = await fetchReactions(msgs.map((m) => m.id));
      setReactions(reacts);
      markConversationRead(conversationId, user.id);
    };
    init();

    const ch = supabase
      .channel(`conv:${conversationId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          (async () => {
            const raw = payload.new as any;
            const decryptedBody = await decryptBody(sharedKeyRef.current, raw.body);
            const incoming = { ...raw, body: decryptedBody } as Message;
            setMessages((m) => (m.some((x) => x.id === incoming.id) ? m : [...m, incoming]));
            if (raw.sender_id !== user.id) {
              markConversationRead(conversationId, user.id);
            }
          })();
        })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          (async () => {
            const raw = payload.new as any;
            const decryptedBody = await decryptBody(sharedKeyRef.current, raw.body);
            setMessages((m) => m.map((x) => (x.id === raw.id ? { ...x, ...raw, body: decryptedBody } : x)));
          })();
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
      const decrypted = await Promise.all(
        (data as Message[]).map(async (m) => ({ ...m, body: await decryptBody(sharedKeyRef.current, m.body) }))
      );
      setRepliedCache((cur) => {
        const next = { ...cur };
        decrypted.forEach((m) => { next[m.id] = m; });
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
        const decryptedOlder = await Promise.all(
          older.map(async (m) => ({ ...m, body: await decryptBody(sharedKeyRef.current, m.body) }))
        );
        setMessages((cur) => [...decryptedOlder, ...cur]);
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
        const bodyToStore = sharedKeyRef.current ? await encryptBody(sharedKeyRef.current, newBody) : newBody;
        await editMessage(editingMessage.id, bodyToStore);
        setMessages((cur) =>
          cur.map((x) => (x.id === editingMessage.id ? { ...x, body: newBody, edited_at: new Date().toISOString() } : x))
        );
        setEditingMessage(null);
        setText("");
        return;
      }

      const plaintext = text.trim();
      const bodyToSend = sharedKeyRef.current ? await encryptBody(sharedKeyRef.current, plaintext) : plaintext;
      const m = await sendMessage(conversationId, user.id, bodyToSend, replyTo?.id ?? null);
      setMessages((cur) => (cur.some((x) => x.id === m.id) ? cur : [...cur, { ...m, body: plaintext }]));
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

  const handleShareLocation = async () => {
    if (!user || !conversationId || sharingLocation) return;
    if (!navigator.geolocation) {
      toast.error("المتصفح لا يدعم مشاركة الموقع");
      return;
    }
    setSharingLocation(true);
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000 });
      });
      // إحداثيات الموقع بتتبعت نص عادي (مش مشفّرة) — نفس الاتفاق إن بيانات
      // الموقع نصية بحتة ومفيش حرج في تخزينها دائم زي باقي بيانات النصوص.
      const body = makeLocationBody(position.coords.latitude, position.coords.longitude);
      const m = await sendMessage(conversationId, user.id, body, null);
      setMessages((cur) => (cur.some((x) => x.id === m.id) ? cur : [...cur, m]));
    } catch {
      toast.error("تعذر الوصول للموقع — تأكد من إذن الموقع");
    } finally {
      setSharingLocation(false);
    }
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
          <button
            type="button"
            disabled={sharingLocation}
            onClick={handleShareLocation}
            className="p-2 h-10 shrink-0 text-white/70 hover:text-white disabled:opacity-50"
            aria-label="مشاركة الموقع"
            title="مشاركة الموقع"
          >
            {sharingLocation ? <LoaderIcon className="w-5 h-5 animate-spin" /> : <MapPin className="w-5 h-5" />}
          </button>
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
