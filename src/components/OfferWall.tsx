import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Star, Check } from "lucide-react";
import { startPaymobCheckout, PurchaseProduct } from "@/lib/paymob";
import { usePurchases } from "@/hooks/usePurchases";

interface OfferWallProps {
  open: boolean;
  onClose: () => void;
  durationMs?: number;
}

/**
 * شاشة بيضاء بملء الشاشة تظهر كل 11 لغز، تفضل 15 ثانية وتختفي
 * تلقائيًا (وممكن تتقفل يدويًا كمان بزر ✕). فيها شريط تحميل أخضر
 * أعلى الصفحة بيتملي بالظبط في نفس مدة ظهور الصفحة، وأول سطر في
 * المنتصف تنبيه بالخط الأحمر إن الشاشة هتختفي تاني، وتحتها العرض
 * التسويقي لتلات منتجات شراء.
 */

// ثلاث نجمات ذهبية زي شكل التقييم — بتتعرض جنب أي منتج اتم شراؤه فعلًا.
const PurchasedStars = () => (
  <div className="flex items-center justify-center gap-1" aria-label="تم الشراء - تقييم 3 نجوم">
    {[0, 1, 2].map((i) => (
      <Star key={i} className="w-5 h-5 fill-amber-400 text-amber-400" />
    ))}
  </div>
);

interface OfferSectionProps {
  borderColor: string;
  bgColor: string;
  titleColor: string;
  title: string;
  description: string;
  buttonIdleColor: string;
  buttonLabel: string;
  purchased: boolean;
  busy: boolean;
  disabled: boolean;
  onBuy: () => void;
}

const OfferSection = ({
  borderColor,
  bgColor,
  titleColor,
  title,
  description,
  buttonIdleColor,
  buttonLabel,
  purchased,
  busy,
  disabled,
  onBuy,
}: OfferSectionProps) => (
  <div className={`rounded-2xl border-2 ${borderColor} ${bgColor} p-5 space-y-3`}>
    <h3 className={`text-lg font-bold ${titleColor}`}>{title}</h3>
    <p className="text-sm leading-relaxed text-gray-700">{description}</p>

    {purchased ? (
      <>
        <button
          type="button"
          disabled
          className="w-full py-3 rounded-xl bg-green-600 text-white font-bold flex items-center justify-center gap-2 cursor-default"
        >
          <Check className="w-5 h-5" />
          تم الشراء
        </button>
        <PurchasedStars />
      </>
    ) : (
      <button
        type="button"
        disabled={disabled}
        onClick={onBuy}
        className={`w-full py-3 rounded-xl ${buttonIdleColor} text-white font-bold disabled:opacity-50 transition-colors`}
      >
        {busy ? "جارٍ التحويل إلى الدفع..." : buttonLabel}
      </button>
    )}
  </div>
);

const OfferWall = ({ open, onClose, durationMs = 15000 }: OfferWallProps) => {
  const [busyProduct, setBusyProduct] = useState<null | PurchaseProduct>(null);
  const { purchasedRewardUnlock, purchasedNoInterstitial, purchasedNoAds, refresh } =
    usePurchases();

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(onClose, durationMs);
    return () => clearTimeout(t);
  }, [open, durationMs, onClose]);

  const handleBuy = async (product: PurchaseProduct) => {
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
          {/* شريط تحميل أخضر أعلى الصفحة — بيتملي من 0% لـ 100% بالظبط
              في نفس مدة ظهور الصفحة (durationMs)، ويوصل لآخره في نفس
              لحظة اختفائها تلقائيًا. */}
          <div className="fixed top-0 left-0 right-0 h-1.5 bg-gray-200 z-[10000] overflow-hidden">
            <motion.div
              className="h-full bg-green-500"
              initial={{ width: "0%" }}
              animate={{ width: "100%" }}
              transition={{ duration: durationMs / 1000, ease: "linear" }}
            />
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="absolute top-3 left-3 w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center text-lg"
          >
            ✕
          </button>

          <p className="text-center font-bold text-red-600 pt-6 px-4 text-base md:text-lg">
            ستختفي هذه الصفحة مرة أخرى
          </p>

          <div className="max-w-xl mx-auto px-6 py-6 space-y-6 text-right">
            <h2 className="text-2xl font-extrabold text-center text-gray-900">
              ارتقِ بتجربتك في تحدي الألغاز 🔓
            </h2>

            <OfferSection
              borderColor="border-amber-400"
              bgColor="bg-amber-50"
              titleColor="text-amber-700"
              title="فتح ميزة المكافأة — 30 جنيهًا"
              description="احذف إجابتين خاطئتين وأضف دقيقة كاملة في كل لغز طوال حل ألغاز التحدي، دفعة واحدة وبدون مشاهدة أي إعلان في كل مرة."
              buttonIdleColor="bg-amber-500 hover:bg-amber-600"
              buttonLabel="شراء المكافأة"
              purchased={purchasedRewardUnlock}
              busy={busyProduct === "reward_unlock"}
              disabled={busyProduct !== null}
              onBuy={() => handleBuy("reward_unlock")}
            />

            <OfferSection
              borderColor="border-sky-400"
              bgColor="bg-sky-50"
              titleColor="text-sky-700"
              title="إلغاء إعلانات الفاصل — 30 جنيهًا"
              description="أوقف ظهور إعلان الفاصل اللي بيقاطعك بعد كل 5 ألغاز، والعب التحدي متواصل من غير أي توقف بسبب الإعلانات."
              buttonIdleColor="bg-sky-500 hover:bg-sky-600"
              buttonLabel="شراء بدون إعلانات فاصل"
              purchased={purchasedNoInterstitial || purchasedNoAds}
              busy={busyProduct === "no_interstitial"}
              disabled={busyProduct !== null}
              onBuy={() => handleBuy("no_interstitial")}
            />

            <OfferSection
              borderColor="border-emerald-400"
              bgColor="bg-emerald-50"
              titleColor="text-emerald-700"
              title="إلغاء كل الإعلانات — 50 جنيهًا"
              description="استمتع بالتحدي من أوله لآخره بدون أي إعلانات إطلاقًا — بانر ولا فاصل — وتحصل معها أيضًا على ميزة المكافأة كاملة."
              buttonIdleColor="bg-emerald-600 hover:bg-emerald-700"
              buttonLabel="شراء No اعلانات"
              purchased={purchasedNoAds}
              busy={busyProduct === "no_ads"}
              disabled={busyProduct !== null}
              onBuy={() => handleBuy("no_ads")}
            />

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
