import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  listBlocked,
  unblockUser,
  fetchPublicProfilesByIds,
  setUsernameRpc,
  updateChatPrivacy,
  invalidateAvatarCache,
  type PublicProfile,
  type ChatVisibility,
} from "@/lib/chat/queries";
import UserAvatar from "@/components/chat/UserAvatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Upload, Shield, FileText, BookOpen } from "lucide-react";

const USERNAME_RE = /^[\p{L}0-9_]{3,20}$/u;

const VIS_LABEL: Record<ChatVisibility, string> = {
  everyone: "الجميع",
  friends: "الأصدقاء فقط",
  none: "لا أحد",
};

export default function ChatSettings() {
  const { user } = useAuth();
  const [username, setUsername] = useState("");
  const [originalUsername, setOriginalUsername] = useState("");
  const [bio, setBio] = useState("");
  const [avatarPath, setAvatarPath] = useState<string | null>(null);
  const [blocked, setBlocked] = useState<PublicProfile[]>([]);
  const [notifEnabled, setNotifEnabled] = useState(() => localStorage.getItem("chat_notifs") !== "off");
  const [privLastSeen, setPrivLastSeen] = useState<ChatVisibility>("friends");
  const [privRequests, setPrivRequests] = useState<ChatVisibility>("everyone");
  const [privMessages, setPrivMessages] = useState<ChatVisibility>("friends");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!user) return;
    const { data: p } = await supabase
      .from("profiles")
      .select("username, avatar_url, bio, privacy_last_seen, privacy_friend_requests, privacy_messages")
      .eq("user_id", user.id)
      .maybeSingle();
    setUsername(p?.username ?? "");
    setOriginalUsername(p?.username ?? "");
    setBio((p as any)?.bio ?? "");
    setAvatarPath(p?.avatar_url ?? null);
    setPrivLastSeen(((p as any)?.privacy_last_seen ?? "friends") as ChatVisibility);
    setPrivRequests(((p as any)?.privacy_friend_requests ?? "everyone") as ChatVisibility);
    setPrivMessages(((p as any)?.privacy_messages ?? "friends") as ChatVisibility);

    const bl = await listBlocked(user.id);
    const profs = await fetchPublicProfilesByIds(bl.map((b: any) => b.blocked_id));
    setBlocked(profs);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const upload = async (file: File) => {
    if (!user) return;
    if (file.size > 4 * 1024 * 1024) {
      toast.error("الصورة كبيرة جداً");
      return;
    }
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${user.id}/avatar-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (error) {
      toast.error(error.message);
      return;
    }
    setAvatarPath(path);
    await supabase.from("profiles").update({ avatar_url: path }).eq("user_id", user.id);
    toast.success("تم تحديث الصورة");
  };

  const save = async () => {
    if (!user) return;
    setSaving(true);
    try {
      if (username !== originalUsername) {
        if (!USERNAME_RE.test(username)) throw new Error("اسم مستخدم غير صالح");
        try {
          await setUsernameRpc(username);
          setOriginalUsername(username);
        } catch (e: any) {
          const msg = String(e?.message ?? "");
          if (msg.includes("change_cooldown")) throw new Error("لا يمكن تغيير الاسم إلا كل 30 يوماً");
          if (msg.includes("username_taken")) throw new Error("اسم المستخدم مأخوذ");
          throw e;
        }
      }
      await updateChatPrivacy(user.id, {
        bio,
        privacy_last_seen: privLastSeen,
        privacy_friend_requests: privRequests,
        privacy_messages: privMessages,
      });
      toast.success("تم الحفظ");
    } catch (e: any) {
      toast.error(e?.message ?? "فشل الحفظ");
    } finally {
      setSaving(false);
    }
  };

  const toggleNotifs = (v: boolean) => {
    setNotifEnabled(v);
    localStorage.setItem("chat_notifs", v ? "on" : "off");
  };

  if (loading)
    return (
      <div className="flex justify-center pt-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );

  return (
    <div className="p-4 space-y-6">
      <section className="card-horror p-4">
        <h2 className="font-horror text-primary mb-4">البروفايل</h2>
        <div className="flex items-center gap-4 mb-4">
          <UserAvatar url={avatarPath} username={username} size="lg" />
          <label className="cursor-pointer text-sm text-primary inline-flex items-center gap-2 border border-primary/40 rounded-md px-3 py-1.5">
            <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
            <Upload className="w-4 h-4" /> تغيير الصورة
          </label>
        </div>
        <label className="text-sm font-typewriter">اسم المستخدم</label>
        <Input value={username} onChange={(e) => setUsername(e.target.value.trim())} className="mt-1" />
        <p className="text-xs text-muted-foreground mt-1">
          يمكن تغيير الاسم مرة واحدة كل 30 يوماً — حروف عربية/إنجليزية وأرقام و _
        </p>

        <label className="text-sm font-typewriter mt-4 block">نبذة</label>
        <Textarea
          value={bio}
          onChange={(e) => setBio(e.target.value.slice(0, 200))}
          className="mt-1"
          rows={3}
          placeholder="اكتب شيئاً عن نفسك (اختياري، حتى 200 حرف)"
        />

        <Button className="mt-3 w-full" onClick={save} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "حفظ التغييرات"}
        </Button>
      </section>

      <section className="card-horror p-4 space-y-3">
        <h2 className="font-horror text-primary mb-2">الخصوصية</h2>

        <PrivacyRow label="من يرى آخر ظهور" value={privLastSeen} onChange={setPrivLastSeen} />
        <PrivacyRow label="من يرسل طلبات صداقة" value={privRequests} onChange={setPrivRequests} />
        <PrivacyRow label="من يرسل الرسائل" value={privMessages} onChange={setPrivMessages} />
      </section>

      <section className="card-horror p-4">
        <h2 className="font-horror text-primary mb-3">الإشعارات</h2>
        <div className="flex items-center justify-between">
          <span className="text-sm font-typewriter">إشعارات داخل التطبيق</span>
          <Switch checked={notifEnabled} onCheckedChange={toggleNotifs} />
        </div>
      </section>

      <section className="card-horror p-4">
        <h2 className="font-horror text-primary mb-3">المستخدمون المحظورون ({blocked.length})</h2>
        {blocked.length === 0 ? (
          <p className="text-sm text-muted-foreground font-typewriter">لا يوجد محظورون</p>
        ) : (
          <ul className="space-y-2">
            {blocked.map((b) => (
              <li key={b.user_id} className="flex items-center gap-3">
                <UserAvatar url={b.avatar_url} username={b.username} size="sm" />
                <span className="flex-1 font-typewriter">{b.username}</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    await unblockUser(user!.id, b.user_id);
                    load();
                  }}
                >
                  رفع الحظر
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card-horror p-4 space-y-2">
        <h2 className="font-horror text-primary mb-2">السلامة والخصوصية</h2>
        <Link to="/chat/safety" className="flex items-center gap-2 text-sm py-2">
          <Shield className="w-4 h-4 text-primary" />
          مركز السلامة
        </Link>
        <Link to="/chat/guidelines" className="flex items-center gap-2 text-sm py-2">
          <BookOpen className="w-4 h-4 text-primary" />
          إرشادات المجتمع
        </Link>
        <Link to="/chat/privacy" className="flex items-center gap-2 text-sm py-2">
          <FileText className="w-4 h-4 text-primary" />
          سياسة الخصوصية
        </Link>
      </section>
    </div>
  );
}

function PrivacyRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: ChatVisibility;
  onChange: (v: ChatVisibility) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm font-typewriter flex-1">{label}</span>
      <Select value={value} onValueChange={(v) => onChange(v as ChatVisibility)}>
        <SelectTrigger className="w-40">
          <SelectValue>{VIS_LABEL[value]}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="everyone">الجميع</SelectItem>
          <SelectItem value="friends">الأصدقاء فقط</SelectItem>
          <SelectItem value="none">لا أحد</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
