import { AnimatePresence, motion } from "framer-motion";
import { useEffect } from "react";
import { Trophy } from "lucide-react";

interface WeeklyAnnouncementBannerProps {
  open: boolean;
  onClose: () => void;
  durationMs?: number;
}

/**
 * بانر يومي بينزل من فوق زي إشعار حقيقي، يذكّر المستخدم بموعد إعلان
 * الفائزين وكل جديد كل سبت من 9 لـ 11 بالليل. بيظهر كل 23 لغز،
 * ويختفي تلقائيًا بعد المدة المحددة. لا يظهر أبدًا فوق الإعلانات أو
 * صفحة الدفع — الشرط ده بيتحكم فيه الأب (Index.tsx) قبل ما يعرضه أصلًا.
 */
const WeeklyAnnouncementBanner = ({
  open,
  onClose,
  durationMs = 15000,
}: WeeklyAnnouncementBannerProps) => {
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(onClose, durationMs);
    return () => clearTimeout(t);
  }, [open, durationMs, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ y: "-120%" }}
          animate={{ y: 0 }}
          exit={{ y: "-120%" }}
          transition={{ type: "spring", stiffness: 260, damping: 26 }}
          className="fixed top-0 left-0 right-0 z-[70] px-3 pt-3"
          role="status"
        >
          <div className="max-w-md mx-auto rounded-2xl bg-gradient-to-l from-amber-500 to-amber-600 text-white shadow-2xl px-4 py-3 flex items-start gap-3">
            <Trophy className="w-6 h-6 shrink-0 mt-0.5" />
            <p className="text-sm leading-relaxed font-semibold">
              كل سبت من الساعة 9 لـ 11 بالليل، بنعلن الفائز بالجائزة
              الأسبوعية وكل جديد في التحدي — تابعنا وكن مستعدًا! 🏆
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default WeeklyAnnouncementBanner;
