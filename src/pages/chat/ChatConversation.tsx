import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  fetchMessages,
  sendMessage,
  fetchReactions,
  markConversationRead,
  fetchPublicProfile,
  fetchPresenceForUsers,
  isOnline,
  type Message,
  type Reaction,
  type PublicProfile,
} from "@/lib/chat/queries";
import MessageBubble from "@/components/chat/MessageBubble";
import UserAvatar from "@/components/chat/UserAvatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, ArrowRight, Ban, Flag, MoreVertical } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import ReportDialog from "@/components/chat/ReportDialog";
import { blockUser } from "@/lib/chat/queries";
import { toast } from "sonner";

export default function ChatConversation() {
  const { id: conversationId } = useParams<{ id: string }>();
  const { user } = useAuth();
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
  const bottomRef = useRef<HTMLDivElement>(null);
  const typingChannelRef = useRef<ReturnType<typeof typingChannel> | null>(null);
  const typingTimerRef = useRef<number | null>(null);
  const otherTypingTimerRef = useRef<number | null>(null);
  const lastTypingSentRef = useRef(0);

  useEffect(() => {
    if (!conversationId || !user) return;
    let active = true;

    const init = async () => {
      const { data: conv } = await supabase.from("conversations").select("*").eq("id", conversationId).maybeSingle();
      if (!conv || !active) return;
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
          if ((payload.new as any).sender_id !== user.id) markConversationRead(conversationId, user.id);
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
    setSending(true);
    try {
      const m = await sendMessage(conversationId, user.id, text.trim());
      setMessages((cur) => (cur.some((x) => x.id === m.id) ? cur : [...cur, m]));
      setText("");
    } catch (e: any) {
      toast.error(e?.message ?? "تعذر إرسال الرسالة");
    } finally {
      setSending(false);
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
            <UserAvatar url={other.avatar_url} username={other.username} online={online} size="sm" />
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
            <DropdownMenuItem onClick={() => { setReportMsgId(undefined); setReportOpen(true); }}>
              <Flag className="w-4 h-4 ml-2" />الإبلاغ عن المستخدم
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleBlock} className="text-destructive">
              <Ban className="w-4 h-4 ml-2" />حظر المستخدم
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {messages.map((m) => (
          <MessageBubble
            key={m.id}
            message={m}
            mine={m.sender_id === user!.id}
            reactions={reactions.filter((r) => r.message_id === m.id)}
            myUserId={user!.id}
            onReport={(msg) => { setReportMsgId(msg.id); setReportOpen(true); }}
          />
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-border p-2 flex gap-2 items-end bg-card">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="اكتب رسالة... (استخدم @ للإشارة لصديق)"
          rows={1}
          className="resize-none min-h-[40px] max-h-32"
          maxLength={2000}
        />
        <Button onClick={send} disabled={!text.trim() || sending} size="icon"><Send className="w-4 h-4" /></Button>
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
