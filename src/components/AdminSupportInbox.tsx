import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type Thread = { user_id: string; username: string | null; last_body: string; last_at: string; unread: boolean };
type Msg = { id: string; sender: "user" | "admin"; body: string; created_at: string };

/**
 * صندوق وارد خدمة العملاء — يظهر لصاحب التطبيق فقط (نفس شرط
 * has_role admin المستخدم في باقي صفحة Admin). كل رسائل المستخدمين
 * (بما فيها استفسارات البائعين عن استلام أرباحهم) بتظهر هنا فقط.
 */
export default function AdminSupportInbox() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [openUserId, setOpenUserId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [reply, setReply] = useState("");

  useEffect(() => { loadThreads(); }, []);

  async function loadThreads() {
    const { data } = await supabase
      .from("support_messages")
      .select("user_id, sender, body, created_at, read_by_admin, profiles!inner(username)")
      .order("created_at", { ascending: false });
    if (!data) return;

    const byUser = new Map<string, Thread>();
    for (const row of data as any[]) {
      if (!byUser.has(row.user_id)) {
        byUser.set(row.user_id, {
          user_id: row.user_id,
          username: row.profiles?.username ?? null,
          last_body: row.body,
          last_at: row.created_at,
          unread: row.sender === "user" && !row.read_by_admin,
        });
      }
    }
    setThreads([...byUser.values()]);
  }

  async function openThread(userId: string) {
    setOpenUserId(userId);
    const { data } = await supabase
      .from("support_messages")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });
    setMessages((data as Msg[]) ?? []);
    await supabase.from("support_messages").update({ read_by_admin: true }).eq("user_id", userId).eq("sender", "user");
  }

  async function sendReply() {
    if (!openUserId || !reply.trim()) return;
    const body = reply.trim();
    setReply("");
    const { data: session } = await supabase.auth.getSession();
    const token = session?.session?.access_token;
    await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-reply-support`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ user_id: openUserId, body }),
    });
    openThread(openUserId);
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="md:col-span-1 border border-primary/30 rounded-xl divide-y divide-primary/10 max-h-[70vh] overflow-y-auto">
        {threads.map((t) => (
          <button
            key={t.user_id}
            onClick={() => openThread(t.user_id)}
            className={`w-full text-right p-3 text-sm ${openUserId === t.user_id ? "bg-primary/10" : ""}`}
          >
            <div className="font-semibold flex items-center gap-2">
              {t.username ?? t.user_id.slice(0, 8)}
              {t.unread && <span className="w-2 h-2 rounded-full bg-blood" />}
            </div>
            <div className="text-muted-foreground truncate">{t.last_body}</div>
          </button>
        ))}
        {threads.length === 0 && <p className="p-3 text-sm text-muted-foreground">لا توجد رسائل بعد.</p>}
      </div>

      <div className="md:col-span-2 border border-primary/30 rounded-xl flex flex-col h-[70vh]">
        {!openUserId ? (
          <p className="m-auto text-sm text-muted-foreground">اختر محادثة من القائمة</p>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${
                    m.sender === "admin" ? "bg-black text-white mr-auto" : "bg-muted ml-auto"
                  }`}
                >
                  {m.body}
                </div>
              ))}
            </div>
            <div className="border-t border-primary/10 p-2 flex gap-2">
              <input
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendReply()}
                className="flex-1 border rounded-full px-3 py-2 text-sm bg-background"
                placeholder="اكتب ردًا..."
              />
              <button onClick={sendReply} className="bg-black text-white rounded-full px-4 py-2 text-sm">
                إرسال
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
