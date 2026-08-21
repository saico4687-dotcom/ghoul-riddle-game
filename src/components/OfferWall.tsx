import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { startPaymobCheckout } from "@/lib/paymob";
import { usePurchases } from "@/hooks/usePurchases";

interface OfferWallProps {
  open: boolean;
  onClose: () => void;
  durationMs?: number;
}

/**
 * شاشة بيضاء بملء الشاشة تظهر كل 11 لغز، تفضل 15 ثانية وتختفي
 * تلقائيًا (وممكن تتقفل يدويًا كمان بزر ✕). في أول سطر في المنتصف
 * تنبيه بالخط الأحمر إن الشاشة هتختفي تاني، وتحتها العرض التسويقي
 * لمنتجَي الشراء.
 */
const OfferWall = ({ open, onClose, durationMs = 15000 }: OfferWallProps) => {
  const [busyProduct, setBusyProduct] = useState<null | "reward_unlock" | "no_ads">(null);
  const { refresh } = usePurchases();

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(onClose, durationMs);
    return () => clearTimeout(t);
  }, [open, durationMs, onClose]);

  const handleBuy = async (product: "reward_unlock" | "no_ads") => {
    setBusyProduct(product);
    try {
      await startPaymobCheckout(product, () => {
        void refresh();
      });
    } finally {
      setBusyProduct(null);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] bg-white text-gray-900 overflow-y-auto"
          dir="rtl"
        >
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="absolute top-3 left-3 w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center text-lg"
          >
            ✕
          </button>

          <p className="text-center font-bold text-red-600 pt-4 px-4 text-base md:text-lg">
            ستختفي هذه الصفحة مرة أخرى
          </p>

          <div className="max-w-xl mx-auto px-6 py-6 space-y-6 text-right">
            <h2 className="text-2xl font-extrabold text-center text-gray-900">
              ارتقِ بتجربتك في تحدي الألغاز 🔓
            </h2>

            <div className="rounded-2xl border-2 border-amber-400 bg-amber-50 p-5 space-y-3">
              <h3 className="text-lg font-bold text-amber-700">فتح ميزة المكافأة — 30 جنيهًا</h3>
              <p className="text-sm leading-relaxed text-gray-700">
                احذف إجابتين خاطئتين وأضف دقيقة كاملة في كل لغز طوال حل ألغاز
                التحدي، دفعة واحدة وبدون مشاهدة أي إعلان في كل مرة.
              </p>
              <button
                type="button"
                disabled={busyProduct !== null}
                onClick={() => handleBuy("reward_unlock")}
                className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold disabled:opacity-50 transition-colors"
              >
                {busyProduct === "reward_unlock" ? "جارٍ التحويل إلى الدفع..." : "شراء المكافأة"}
              </button>
            </div>

            <div className="rounded-2xl border-2 border-emerald-400 bg-emerald-50 p-5 space-y-3">
              <h3 className="text-lg font-bold text-emerald-700">إلغاء كل الإعلانات — 50 جنيهًا</h3>
              <p className="text-sm leading-relaxed text-gray-700">
                استمتع بالتحدي من أوله لآخره بدون أي إعلانات إطلاقًا — بانر
                ولا فاصل — وتحصل معها أيضًا على ميزة المكافأة كاملة.
              </p>
              <button
                type="button"
                disabled={busyProduct !== null}
                onClick={() => handleBuy("no_ads")}
                className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold disabled:opacity-50 transition-colors"
              >
                {busyProduct === "no_ads" ? "جارٍ التحويل إلى الدفع..." : "شراء No اعلانات"}
              </button>
            </div>

            <p className="text-xs text-center text-gray-500 leading-relaxed">
              الدفع سهل وآمن، بأسهل وسيلة وهي الدفع بالمحفظة الإلكترونية.
            </p>

            <p className="text-xs text-center text-gray-400 leading-relaxed border-t border-gray-200 pt-3">
              تنبيه: قد تظهر بعض الإعلانات لأشخاص فوق 18 عامًا. احمِ نفسك
              وأغلق الإعلان إذا كنت في مكان عام أو أمام أفراد الأسرة.
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default OfferWall;
