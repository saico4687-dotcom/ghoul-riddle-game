import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, ShieldCheck, Gift } from "lucide-react";

const CONSENT_KEY = "ads_consent_v1";

interface Props {
  onAccepted?: () => void;
}

const AdsConsentDialog = ({ onAccepted }: Props) => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const v = localStorage.getItem(CONSENT_KEY);
    if (!v) setOpen(true);
  }, []);

  const accept = (personalized: boolean) => {
    localStorage.setItem(
      CONSENT_KEY,
      JSON.stringify({ accepted: true, personalized, ts: Date.now() })
    );
    setOpen(false);
    onAccepted?.();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] bg-background/90 backdrop-blur-sm flex items-center justify-center p-4"
          dir="rtl"
        >
          <motion.div
            initial={{ scale: 0.92, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            className="card-horror w-full max-w-md p-6 space-y-5"
          >
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-full bg-primary/15 text-primary">
                <Gift className="w-6 h-6" />
              </div>
              <div>
                <h2 className="font-horror text-xl text-primary">
                  تطبيق مجاني مدعوم بالإعلانات
                </h2>
                <p className="text-xs text-muted-foreground font-typewriter">
                  نبقّي الخدمة مجانية لك
                </p>
              </div>
            </div>

            <p className="font-typewriter text-sm text-foreground leading-relaxed">
              هذا التطبيق مجاني بالكامل؛ نعرض إعلانات مختصرة من Google AdMob
              لتغطية تكاليف التشغيل وإضافة ألغاز جديدة باستمرار.
            </p>

            <div className="space-y-2 text-sm font-typewriter">
              <div className="flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-primary mt-1 shrink-0" />
                <span>
                  إعلانات قصيرة بين الألغاز، وإعلانات اختيارية لأدوات
                  مساعدة (حذف إجابتين / دقيقة إضافية).
                </span>
              </div>
              <div className="flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-primary mt-1 shrink-0" />
                <span>
                  معرّف الإعلانات قد يُستخدم لعرض إعلانات أنسب، ويمكنك اختيار
                  إعلانات غير مخصّصة لاحقاً.
                </span>
              </div>
              <div className="flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-primary mt-1 shrink-0" />
                <span>
                  يمكنك مشاهدة إعلان اختياري للحصول على أداة مساعدة داخل اللغز
                  بدون أي رسوم أو اشتراكات.
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <button
                onClick={() => accept(true)}
                className="w-full px-4 py-3 rounded-lg bg-gradient-to-r from-primary via-yellow-400 to-primary text-primary-foreground font-horror text-lg shadow-[0_4px_20px_hsl(var(--primary)/0.4)]"
              >
                موافق — إعلانات مخصّصة
              </button>
              <button
                onClick={() => accept(false)}
                className="w-full px-4 py-3 rounded-lg border border-primary/40 text-foreground font-typewriter hover:bg-primary/10 transition-colors"
              >
                إعلانات غير مخصّصة
              </button>
            </div>

            <p className="text-[11px] text-muted-foreground/80 font-typewriter text-center leading-relaxed">
              بالمتابعة فأنت توافق على{" "}
              <a href="/privacy" className="text-primary underline">سياسة الخصوصية</a>{" "}
              و{" "}
              <a href="/terms" className="text-primary underline">شروط الاستخدام</a>.
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AdsConsentDialog;
