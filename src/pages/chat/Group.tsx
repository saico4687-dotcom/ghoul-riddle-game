import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useGroups } from "@/hooks/useGroups";
import { supabase } from "@/integrations/supabase/client";
import { filterMessage } from "@/lib/chat/contentFilter";
import { ensureFreshSession, SESSION_EXPIRED_MESSAGE } from "@/lib/ensureSession";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import UserAvatar from "@/components/chat/UserAvatar";
import { ArrowRight, Camera, Loader2, Users } from "lucide-react";
import { toast } from "sonner";

export default function CreateGroup() {
  useAuth(); // ensures the auth context is initialized before we hit RLS-protected inserts
  const { createGroup } = useGroups();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  // The groups/<id>/avatar/* storage policy needs a real group id, which
  // doesn't exist yet at this point — so we just stage the file in memory
  // here and upload it right after the group row is created in save().
  const stageAvatar = (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("الرجاء اختيار صورة");
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      toast.error("الصورة كبيرة جداً (الحد 4 ميجابايت)");
      return;
    }
    setPendingFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const save = async () => {
    if (!name.trim()) {
      toast.error("اكتب اسم الجروب");
      return;
    }
    if (name.trim().length > 50) {
      toast.error("اسم الجروب طويل جداً (الحد 50 حرف)");
      return;
    }
    setSaving(true);
    try {
      // نتأكد إن جلسة الدخول لسه سارية قبل أي كتابة تعتمد على auth.uid()
      // (إنشاء الجروب + رفع الصورة). لو الـ token انتهت صلاحيته من غير
      // ما الواجهة تلاحظ (بيحصل جوّه WebView التطبيق لو فضل في الخلفية
      // فترة)، auth.uid() هيرجع null على السيرفر وهيفشل بـ RLS برسالة
      // غامضة "new row violates row-level security policy" بدل رسالة
      // واضحة إن الجلسة خلصت.
      const sessionOk = await ensureFreshSession();
      if (!sessionOk) throw new Error(SESSION_EXPIRED_MESSAGE);

      const cleanName = filterMessage(name.trim());
      const cleanDesc = description.trim() ? filterMessage(description.trim()) : null;

      const group = await createGroup({ name: cleanName, description: cleanDesc });

      if (pendingFile) {
        const ext = (pendingFile.name.split(".").pop() ?? "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
        // هذا المسار مطابق لـ storage policy "group avatars: staff upload"
        // (بتشترط is_group_staff على أول عضو owner بيتضاف تلقائيًا فور
        // إنشاء الجروب عن طريق trigger on_group_created).
        const path = `groups/${group.id}/avatar/avatar-${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("avatars")
          .upload(path, pendingFile, { upsert: true, contentType: pendingFile.type, cacheControl: "3600" });

        if (upErr) {
          console.error("[CreateGroup] avatar upload failed", upErr);
          const msg = String((upErr as any)?.message ?? "");
          toast.error(
            msg.toLowerCase().includes("row-level security")
              ? SESSION_EXPIRED_MESSAGE
              : "تم إنشاء الجروب، لكن تعذر حفظ الصورة"
          );
        } else {
          const { error: updateErr } = await supabase
            .from("groups")
            .update({ avatar_url: path })
            .eq("id", group.id);
          if (updateErr) {
            console.error("[CreateGroup] avatar_url update failed", updateErr);
            const msg = String((updateErr as any)?.message ?? "");
            toast.error(
              msg.toLowerCase().includes("row-level security")
                ? SESSION_EXPIRED_MESSAGE
                : "تم إنشاء الجروب، لكن تعذر حفظ الصورة"
            );
          }
        }
      }

      toast.success("تم إنشاء الجروب");
      navigate(`/chat/g/${group.id}`, { replace: true });
    } catch (e: any) {
      toast.error(e?.message ?? "تعذر إنشاء الجروب");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col p-4 gap-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowRight className="w-5 h-5" />
        </Button>
        <h1 className="text-xl font-horror flex items-center gap-2">
          <Users className="w-5 h-5" /> إنشاء جروب جديد
        </h1>
      </div>

      <div className="flex flex-col items-center gap-3">
        <label className="relative cursor-pointer">
          <UserAvatar url={avatarPreview} username={name || "?"} size="xl" />
          <span className="absolute bottom-0 right-0 bg-primary rounded-full p-1.5 border-2 border-background">
            <Camera className="w-4 h-4 text-primary-foreground" />
          </span>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) stageAvatar(f);
            }}
          />
        </label>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-muted-foreground">اسم الجروب</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={50} placeholder="مثال: أصدقاء الألغاز" />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-muted-foreground">الوصف (اختياري)</label>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} placeholder="عن إيه الجروب ده؟" rows={3} />
        </div>
      </div>

      <Button onClick={save} disabled={saving || !name.trim()} className="mt-auto">
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "إنشاء الجروب"}
      </Button>
    </div>
  );
}
