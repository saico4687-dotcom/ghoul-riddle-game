import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, Shield, Ban, VolumeX, Check } from "lucide-react";
import { toast } from "sonner";
import { fetchPublicProfilesByIds, type PublicProfile } from "@/lib/chat/queries";
import UserAvatar from "@/components/chat/UserAvatar";

type Report = {
  id: string;
  reporter_id: string;
  target_user_id: string;
  target_message_id: string | null;
  reason: string;
  status: string;
  created_at: string;
};

type ModAction = {
  id: string;
  admin_id: string | null;
  target_user_id: string;
  action: string;
  until: string | null;
  notes: string | null;
  created_at: string;
};

export default function AdminModeration({ adminId }: { adminId: string }) {
  const [reports, setReports] = useState<Report[]>([]);
  const [history, setHistory] = useState<ModAction[]>([]);
  const [profiles, setProfiles] = useState<Map<string, PublicProfile>>(new Map());
  const [suspended, setSuspended] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [{ data: rep }, { data: hist }, { data: susp }] = await Promise.all([
      supabase.from("reports").select("*").eq("status", "open").order("created_at", { ascending: false }).limit(100),
      supabase.from("moderation_actions").select("*").order("created_at", { ascending: false }).limit(50),
      supabase.from("profiles").select("user_id, username, is_muted_until, is_suspended_until").or("is_muted_until.gt.now,is_suspended_until.gt.now").limit(50),
    ]);
    const r = (rep ?? []) as Report[];
    const h = (hist ?? []) as ModAction[];
    setReports(r);
    setHistory(h);
    setSuspended(susp ?? []);
    const ids = Array.from(new Set([...r.map((x) => x.target_user_id), ...r.map((x) => x.reporter_id), ...h.map((x) => x.target_user_id)]));
    const profs = await fetchPublicProfilesByIds(ids);
    setProfiles(new Map(profs.map((p) => [p.user_id, p])));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const act = async (report: Report, action: "dismiss" | "mute" | "suspend") => {
    if (action === "dismiss") {
      await supabase.from("reports").update({ status: "dismissed" }).eq("id", report.id);
      await supabase.from("moderation_actions").insert({ admin_id: adminId, target_user_id: report.target_user_id, action: "dismiss", notes: `report ${report.id}` });
    } else if (action === "mute") {
      const until = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      await supabase.from("profiles").update({ is_muted_until: until }).eq("user_id", report.target_user_id);
      await supabase.from("moderation_actions").insert({ admin_id: adminId, target_user_id: report.target_user_id, action: "mute", until, notes: `report ${report.id}` });
      await supabase.from("reports").update({ status: "actioned" }).eq("id", report.id);
    } else if (action === "suspend") {
      const until = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      await supabase.from("profiles").update({ is_suspended_until: until }).eq("user_id", report.target_user_id);
      await supabase.from("moderation_actions").insert({ admin_id: adminId, target_user_id: report.target_user_id, action: "suspend", until, notes: `report ${report.id}` });
      await supabase.from("reports").update({ status: "actioned" }).eq("id", report.id);
    }
    toast.success("تم");
    load();
  };

  const lift = async (userId: string, kind: "mute" | "suspend") => {
    const upd = kind === "mute" ? { is_muted_until: null } : { is_suspended_until: null };
    await supabase.from("profiles").update(upd).eq("user_id", userId);
    await supabase.from("moderation_actions").insert({ admin_id: adminId, target_user_id: userId, action: kind === "mute" ? "unmute" : "unsuspend" });
    toast.success("تم رفع الإجراء");
    load();
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  return (
    <section className="space-y-6">
      <div className="bg-card/60 border border-primary/30 rounded-xl p-4">
        <h2 className="font-horror text-xl text-blood mb-3 flex items-center gap-2">
          <Shield className="w-5 h-5" /> طابور البلاغات ({reports.length})
        </h2>
        {reports.length === 0 ? <p className="text-sm text-muted-foreground font-typewriter">لا توجد بلاغات مفتوحة.</p>
          : (
            <ul className="space-y-3">
              {reports.map((r) => {
                const tgt = profiles.get(r.target_user_id);
                const rep = profiles.get(r.reporter_id);
                return (
                  <li key={r.id} className="bg-background/40 rounded-lg p-3 text-sm font-typewriter">
                    <div className="flex items-start gap-3 mb-2">
                      <UserAvatar url={tgt?.avatar_url} username={tgt?.username} size="sm" />
                      <div className="flex-1">
                        <div className="font-horror text-foreground">{tgt?.username ?? r.target_user_id.slice(0, 8)}</div>
                        <div className="text-xs text-muted-foreground">بُلِّغ بواسطة: {rep?.username ?? "?"} — {new Date(r.created_at).toLocaleString("ar-EG")}</div>
                      </div>
                    </div>
                    <p className="text-foreground/90 bg-card p-2 rounded mb-2">{r.reason}</p>
                    {r.target_message_id && <p className="text-xs text-muted-foreground mb-2">معرّف الرسالة: {r.target_message_id}</p>}
                    <div className="flex gap-2 flex-wrap">
                      <Button size="sm" variant="ghost" onClick={() => act(r, "dismiss")}><Check className="w-3 h-3 ml-1" />رفض البلاغ</Button>
                      <Button size="sm" variant="outline" onClick={() => act(r, "mute")}><VolumeX className="w-3 h-3 ml-1" />كتم 24س</Button>
                      <Button size="sm" variant="destructive" onClick={() => act(r, "suspend")}><Ban className="w-3 h-3 ml-1" />إيقاف 7 أيام</Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
      </div>

      <div className="bg-card/60 border border-border/40 rounded-xl p-4">
        <h2 className="font-horror text-xl text-blood mb-3">المستخدمون المكتومون / الموقوفون ({suspended.length})</h2>
        {suspended.length === 0 ? <p className="text-sm text-muted-foreground font-typewriter">لا يوجد.</p>
          : (
            <ul className="space-y-2">
              {suspended.map((s) => (
                <li key={s.user_id} className="flex items-center justify-between bg-background/40 rounded p-2 text-sm font-typewriter">
                  <div>
                    <div className="font-horror text-foreground">{s.username ?? s.user_id.slice(0, 8)}</div>
                    {s.is_muted_until && new Date(s.is_muted_until) > new Date() && <div className="text-xs text-amber-400">مكتوم حتى {new Date(s.is_muted_until).toLocaleString("ar-EG")}</div>}
                    {s.is_suspended_until && new Date(s.is_suspended_until) > new Date() && <div className="text-xs text-destructive">موقوف حتى {new Date(s.is_suspended_until).toLocaleString("ar-EG")}</div>}
                  </div>
                  <div className="flex gap-1">
                    {s.is_muted_until && new Date(s.is_muted_until) > new Date() && <Button size="sm" variant="ghost" onClick={() => lift(s.user_id, "mute")}>رفع الكتم</Button>}
                    {s.is_suspended_until && new Date(s.is_suspended_until) > new Date() && <Button size="sm" variant="ghost" onClick={() => lift(s.user_id, "suspend")}>رفع الإيقاف</Button>}
                  </div>
                </li>
              ))}
            </ul>
          )}
      </div>

      <div className="bg-card/60 border border-border/40 rounded-xl p-4">
        <h2 className="font-horror text-xl text-blood mb-3">سجل الإشراف</h2>
        <ul className="space-y-1 text-xs font-typewriter">
          {history.map((h) => {
            const tgt = profiles.get(h.target_user_id);
            return (
              <li key={h.id} className="bg-background/40 rounded px-2 py-1">
                <span className="text-primary">{h.action}</span> على <span className="text-foreground">{tgt?.username ?? h.target_user_id.slice(0, 8)}</span>
                {h.until && <span> حتى {new Date(h.until).toLocaleString("ar-EG")}</span>}
                {h.admin_id ? <span className="text-muted-foreground"> · بواسطة مشرف</span> : <span className="text-muted-foreground"> · تلقائي</span>}
                <span className="text-muted-foreground"> · {new Date(h.created_at).toLocaleString("ar-EG")}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
