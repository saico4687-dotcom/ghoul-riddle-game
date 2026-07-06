import { useState } from "react";
import { motion } from "framer-motion";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import HorrorButton from "./HorrorButton";
import { User, Phone, MapPin } from "lucide-react";
import { toast } from "sonner";

const schema = z.object({
  full_name: z.string().trim().min(5, "ادخل الاسم الثلاثي كاملاً").max(120),
  phone: z.string().trim().min(8, "رقم الموبايل غير صحيح").max(20),
  address: z.string().trim().min(5, "أدخل العنوان بشكل صحيح").max(250),
});

interface Props {
  userId: string;
  defaults?: { full_name?: string | null; phone?: string | null; address?: string | null };
  onSaved: () => void;
}

const ParticipantInfoForm = ({ userId, defaults, onSaved }: Props) => {
  const [full_name, setFullName] = useState(defaults?.full_name ?? "");
  const [phone, setPhone] = useState(defaults?.phone ?? "");
  const [address, setAddress] = useState(defaults?.address ?? "");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    const parsed = schema.safeParse({ full_name, phone, address });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setLoading(true);
    const { error } = await supabase
  .from("profiles")
  .upsert(
    {
      user_id: userId,
      ...parsed.data,
      updated_at: new Date().toISOString(),
    },
    {
      onConflict: "user_id",
    }
  );
    setLoading(false);
    if (error) {
      toast.error("تعذّر حفظ البيانات، حاول مرة أخرى");
      return;
    }
    toast.success("تم حفظ بياناتك");
    onSaved();
  };

  return (
    <div className="min-h-screen bg-horror-gradient flex items-center justify-center px-4 py-8" dir="rtl">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card-horror p-6 w-full max-w-md space-y-5"
      >
        <div className="text-center">
          <h1 className="font-horror text-3xl text-primary mb-2">بيانات المشاركة</h1>
          <p className="font-typewriter text-sm text-muted-foreground">
            اختيارية لتحسين تجربتك وحفظ بياناتك داخل التطبيق.
          </p>
        </div>

        <div className="space-y-3">
          <div className="space-y-1">
            <label className="font-typewriter text-sm flex items-center gap-2 text-foreground/90">
              <User className="w-4 h-4 text-primary" /> الاسم الثلاثي
            </label>
            <input
              value={full_name}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="مثال: محمد أحمد علي"
              className="w-full px-3 py-2 rounded-lg bg-background/60 border border-primary/30 font-typewriter focus:outline-none focus:border-primary"
            />
          </div>

          <div className="space-y-1">
            <label className="font-typewriter text-sm flex items-center gap-2 text-foreground/90">
              <Phone className="w-4 h-4 text-primary" /> رقم الموبايل
            </label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="مثال: 01xxxxxxxxx"
              inputMode="tel"
              className="w-full px-3 py-2 rounded-lg bg-background/60 border border-primary/30 font-typewriter focus:outline-none focus:border-primary"
            />
          </div>

          <div className="space-y-1">
            <label className="font-typewriter text-sm flex items-center gap-2 text-foreground/90">
              <MapPin className="w-4 h-4 text-primary" /> العنوان بالتفصيل
            </label>
            <textarea
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="المحافظة - المدينة - الشارع - رقم المنزل"
              rows={3}
              className="w-full px-3 py-2 rounded-lg bg-background/60 border border-primary/30 font-typewriter focus:outline-none focus:border-primary resize-none"
            />
          </div>
        </div>

        <HorrorButton onClick={submit} disabled={loading}>
          {loading ? "جارِ الحفظ..." : "حفظ والمتابعة"}
        </HorrorButton>

        <p className="text-[11px] text-muted-foreground/80 font-typewriter text-center">
          بياناتك محفوظة بأمان ولن تُستخدم إلا لتشغيل التطبيق وتحسين تجربتك.
        </p>
      </motion.div>
    </div>
  );
};

export default ParticipantInfoForm;
