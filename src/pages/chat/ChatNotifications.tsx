import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, MessageSquare, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";

type Notif = { id: string; type: string; payload: any; read_at: string | null; created_at: string };

export default function ChatNotifications() {
  const { user } = useAuth();
  const [items, setItems] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100);
    setItems((data ?? []) as Notif[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const markAllRead = async () => {
    if (!user) return;
    await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", user.id).is("read_at", null);
    load();
  };

  if (loading) return <div className="flex justify-center pt-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-3">
        <h2 className="font-horror text-primary">الإشعارات</h2>
        {items.some((i) => !i.read_at) && (
          <Button size="sm" variant="ghost" onClick={markAllRead}>تمييز الكل كمقروء</Button>
        )}
      </div>
      {items.length === 0 ? <p className="text-center text-muted-foreground font-typewriter py-8">لا توجد إشعارات</p>
        : (
          <ul className="space-y-2">
            {items.map((n) => (
              <li key={n.id} className={`card-horror p-3 flex items-center gap-3 ${!n.read_at ? "border-primary/60" : ""}`}>
                {n.type === "new_message" ? <MessageSquare className="w-5 h-5 text-primary" /> : <UserPlus className="w-5 h-5 text-primary" />}
                <div className="flex-1">
                  <div className="font-typewriter text-sm">
                    {n.type === "new_message" ? "رسالة جديدة"
                      : n.type === "friend_request" ? "طلب صداقة جديد"
                      : n.type === "friend_accepted" ? "تم قبول طلب صداقتك"
                      : n.type}
                  </div>
                  <div className="text-[11px] text-muted-foreground">{new Date(n.created_at).toLocaleString("ar-EG")}</div>
                </div>
                {n.type === "new_message" && n.payload?.conversation_id && (
                  <Link to={`/chat/c/${n.payload.conversation_id}`} className="text-primary text-sm">فتح</Link>
                )}
                {(n.type === "friend_request" || n.type === "friend_accepted") && (
                  <Link to="/chat/friends" className="text-primary text-sm">عرض</Link>
                )}
              </li>
            ))}
          </ul>
        )}
    </div>
  );
}
