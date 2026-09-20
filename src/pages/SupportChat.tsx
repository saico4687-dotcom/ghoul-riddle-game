import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type Msg = { id: string; sender: "user" | "admin"; body: string; created_at: string };

const WELCOME_TEXT =
  "أهلاً بك 🎉 مبروك على تقدمك! اترك رسالتك هنا (مثلاً استفسار عن طريقة استلام أرباحك) وسيتم الرد عليك قريبًا.";

export default function SupportChat() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    load();
    const channel = supabase
      .channel(`support_${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "support_messages", filter: `user_id=eq.${user.id}` },
        (payload) => setMessages((m) => [...m, payload.new as Msg]),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function load() {
    if (!user) return;
    const { data } = await supabase
      .from("support_messages")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });

    if (!data || data.length === 0) {
      // أول فتح: رسالة ترحيب تلقائية (نصية بس محليًا، ما تتخزنش في
      // الجدول عشان مانحسبهاش ضمن رسائل المستخدم الحقيقية للأدمن)
      setMessages([{ id: "welcome", sender: "admin", body: WELCOME_TEXT, created_at: new Date().toISOString() }]);
    } else {
      setMessages(data as Msg[]);
    }
  }

  async function send() {
    if (!user || !text.trim()) return;
    const body = text.trim();
    setText("");
    const { error } = await supabase.from("support_messages").insert({ user_id: user.id, sender: "user", body });
    if (error) console.error(error);
  }

  return (
    <div className="min-h-screen bg-white text-black flex flex-col" dir="rtl">
      <div className="border-b border-gray-200 px-4 py-3 font-bold">خدمة العملاء</div>
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`max-w-[80%] rounded-xl px-4 py-2 text-sm ${
              m.sender === "admin" ? "bg-gray-100 self-start" : "bg-black text-white self-end"
            }`}
          >
            {m.body}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <div className="border-t border-gray-200 p-3 flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="اكتب رسالتك..."
          className="flex-1 border border-gray-300 rounded-full px-4 py-2 text-sm"
        />
        <button onClick={send} className="bg-black text-white rounded-full px-5 py-2 text-sm font-semibold">
          إرسال
        </button>
      </div>
    </div>
  );
}
