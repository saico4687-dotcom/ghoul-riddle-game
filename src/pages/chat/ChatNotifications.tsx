import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, MessageSquare, UserPlus, UserCheck, Bell, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

type Notif = { id: string; type: string; payload: any; read_at: string | null; created_at: string };

export default function ChatNotifications() {
  const { user } = useAuth();
  const [items, setItems] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100);
    setItems((data ?? []) as Notif[]);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
    if (!user) return;
    const ch = supabase
      .channel(`notif-page:${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => load(),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, load]);

  // Auto-mark unread notifications as read once viewed
  useEffect(() => {
    if (!user || loading) return;
    const unreadIds = items.filter((n) => !n.read_at).map((n) => n.id);
    if (unreadIds.length === 0) return;
    const t = setTimeout(() => {
      supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .in("id", unreadIds)
        .then(() => {
          setItems((prev) => prev.map((n) => unreadIds.includes(n.id) ? { ...n, read_at: new Date().toISOString() } : n));
        });
    }, 1200);
    return () => clearTimeout(t);
  }, [items, user, loading]);

  const markAllRead = async () => {
    if (!user) return;
    await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", user.id).is("read_at", null);
    load();
  };

  if (loading) return <div className="flex justify-center pt-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  const unreadCount = items.filter((i) => !i.read_at).length;

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-3">
        <h2 className="font-horror text-primary flex items-center gap-2">
          <Bell className="w-4 h-4" /> الإشعارات
          {unreadCount > 0 && (
            <span className="bg-destructive text-destructive-foreground text-[10px] rounded-full px-2 py-0.5">{unreadCount}</span>
          )}
        </h2>
        {unreadCount > 0 && (
          <Button size="sm" variant="ghost" onClick={markAllRead}>
            <CheckCheck className="w-4 h-4 mr-1" /> تمييز الكل كمقروء
          </Button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="text-center py-16 space-y-2">
          <Bell className="w-10 h-10 text-muted-foreground/50 mx-auto" />
          <p className="text-muted-foreground font-typewriter">لا توجد إشعارات</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((n) => {
            const unread = !n.read_at;
            const icon = n.type === "new_message" ? <MessageSquare className="w-5 h-5 text-primary" />
              : n.type === "friend_accepted" ? <UserCheck className="w-5 h-5 text-primary" />
              : <UserPlus className="w-5 h-5 text-primary" />;
            const label = n.type === "new_message" ? "رسالة جديدة"
              : n.type === "friend_request" ? "طلب صداقة جديد"
              : n.type === "friend_accepted" ? "تم قبول طلب صداقتك"
              : n.type;
            const to = n.type === "new_message" && n.payload?.conversation_id
              ? `/chat/c/${n.payload.conversation_id}`
              : "/chat/friends";
            return (
              <li key={n.id}>
                <Link
                  to={to}
                  className={`card-horror p-3 flex items-center gap-3 transition-colors hover:border-primary/60 ${unread ? "border-primary/60 bg-primary/5" : ""}`}
                >
                  <div className="relative">
                    {icon}
                    {unread && <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-destructive" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-typewriter text-sm">{label}</div>
                    <div className="text-[11px] text-muted-foreground">{new Date(n.created_at).toLocaleString("ar-EG")}</div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
