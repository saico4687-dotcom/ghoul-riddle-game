import { AnimatePresence, motion } from "framer-motion";
import { Star, Video } from "lucide-react";
import { Browser } from "@capacitor/browser";
import { isNativePlatform } from "@/lib/isNative";

// رابط التطبيق على Google Play (نفس الـ package بتاع التطبيق).
const STORE_URL = "https://play.google.com/store/apps/details?id=com.rebh.app";

interface Props {
  open: boolean;
  onClose: () => void;
}

const VideoRatingNotice = ({ open, onClose }: Props) => {
  const handleRate = async () => {
    try {
      if (isNativePlatform()) await Browser.open({ url: STORE_URL });
      else window.open(STORE_URL, "_blank", "noopener,noreferrer");
    } catch {
      /* تجاهل — المستخدم يقدر يقيّم لاحقًا */
    }
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] bg-background/90 backdrop-blur-sm flex items-center justify-center p-4"
          dir="rtl"
          role="dialog"
          aria-modal="true"
        >
          <motion.div
            initial={{ scale: 0.92, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            className="card-horror w-full max-w-md p-6 space-y-5 text-center"
          >
            <Video className="w-12 h-12 mx-auto text-primary" />
            <h2 className="font-horror text-2xl text-primary">
              أكملت 100 لغز مع الفيديوهات 🎬
            </h2>
            <p className="font-typewriter text-sm text-foreground/90 leading-loose">
              نعمل على إضافة فيديو تمهيدي لكل لغز من الألغاز القادمة. دعمكم
              وتقييمكم الصادق للتطبيق على المتجر يساعدنا على الوصول إلى لاعبين
              أكثر ويمنحنا الدافع لتطوير المزيد من المحتوى، شكرًا لكم.
            </p>
            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={handleRate}
                className="flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-primary text-primary-foreground font-typewriter hover:opacity-90 transition"
              >
                <Star className="w-5 h-5" />
                <span>قيّم التطبيق</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2 rounded-lg border border-border text-foreground/80 font-typewriter text-sm hover:bg-muted transition"
              >
                لاحقًا
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default VideoRatingNotice;
