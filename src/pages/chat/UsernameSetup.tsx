import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Upload } from "lucide-react";
import UserAvatar from "@/components/chat/UserAvatar";

// Arabic + English + digits + underscore, 3-20 chars. Any script letter is allowed via \p{L}.
const USERNAME_RE = /^[\p{L}0-9_]{3,20}$/u;

export default function UsernameSetup() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [avatarPath, setAvatarPath] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("username, avatar_url, completed")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.username) navigate("/chat", { replace: true });
        else if (!data?.completed) navigate("/", { replace: true });
        if (data?.avatar_url) setAvatarPath(data.avatar_url);
      });
  }, [user, navigate]);

  useEffect(() => {
    if (!USERNAME_RE.test(username)) {
      setAvailable(null);
      return;
    }
    setChecking(true);
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("username", username)
        .maybeSingle();
      setAvailable(!data || data.user_id === user?.id);
      setChecking(false);
    }, 350);
    return () => clearTimeout(t);
  }, [username, user]);

  const upload = async (file: File) => {
    if (!user) return;
    if (file.size > 4 * 1024 * 1024) {
      toast.error("الصورة كبيرة جداً (الحد 4MB)");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${user.id}/avatar-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
      if (error) throw error;
      setAvatarPath(path);
      toast.success("تم رفع الصورة");
    } catch (e: any) {
      toast.error(e?.message ?? "فشل رفع الصورة");
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (!user) return;
    if (!USERNAME_RE.test(username)) {
      toast.error("اسم المستخدم: حروف (عربية أو إنجليزية) وأرقام و _ ، 3 إلى 20 حرف");
      return;
    }
    if (available === false) {
      toast.error("اسم المستخدم مأخوذ");
      return;
    }
    setSaving(true);
    try {
      const { error: e1 } = await supabase.rpc("set_username", { _new: username });
      if (e1) throw e1;
      if (avatarPath) {
        await supabase.from("profiles").update({ avatar_url: avatarPath }).eq("user_id", user.id);
      }
      toast.success("تم!");
      navigate("/chat", { replace: true });
    } catch (e: any) {
      const msg = String(e?.message ?? "");
      if (msg.includes("username_taken")) toast.error("اسم المستخدم مأخوذ");
      else if (msg.includes("change_cooldown")) toast.error("لا يمكن تغيير الاسم إلا كل 30 يوماً");
      else if (msg.includes("invalid_format") || msg.includes("invalid_length")) toast.error("تنسيق غير صحيح");
      else toast.error(msg || "فشل الحفظ");
    } finally {
      setSaving(false);
    }
  };

  if (authLoading)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6" dir="rtl">
      <div className="card-horror p-6 w-full max-w-md">
        <h1 className="font-horror text-2xl text-primary mb-2 text-center">إعداد بروفايل الدردشة</h1>
        <p className="font-typewriter text-sm text-muted-foreground mb-6 text-center">
          اختر اسم مستخدم فريد وصورة (اختياري) للظهور للأصدقاء
        </p>

        <div className="flex flex-col items-center gap-3 mb-6">
          <UserAvatar url={avatarPath} username={username || "?"} size="xl" />
          <label className="cursor-pointer">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
            />
            <span className="inline-flex items-center gap-2 text-sm text-primary border border-primary/40 rounded-md px-3 py-1.5 hover:bg-primary/10">
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {avatarPath ? "تغيير الصورة" : "رفع صورة (اختياري)"}
            </span>
          </label>
        </div>

        <div className="mb-6">
          <label className="text-sm text-foreground/80 font-typewriter">اسم المستخدم</label>
          <Input
            value={username}
            onChange={(e) => setUsername(e.target.value.trim())}
            placeholder="مثال: ahmed_2024 أو أحمد_2024"
            className="mt-1"
          />
          <p className="text-xs mt-1 text-muted-foreground">
            {!username
              ? "حروف عربية أو إنجليزية وأرقام و _ ، 3-20 حرف"
              : !USERNAME_RE.test(username)
                ? "تنسيق غير صحيح"
                : checking
                  ? "جاري التحقق..."
                  : available === false
                    ? "❌ مأخوذ"
                    : available
                      ? "✅ متاح"
                      : ""}
          </p>
        </div>

        <Button className="w-full" onClick={save} disabled={saving || available !== true}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "متابعة إلى الدردشة"}
        </Button>
      </div>
    </div>
  );
}
