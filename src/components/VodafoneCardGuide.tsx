import { motion } from "framer-motion";
import { CreditCard, Smartphone, Wallet, Timer, ArrowRight } from "lucide-react";

interface VodafoneCardGuideProps {
  onBack: () => void;
}

interface StepProps {
  icon: React.ReactNode;
  number: number;
  title: string;
  description: string;
}

const Step = ({ icon, number, title, description }: StepProps) => (
  <div className="flex items-start gap-4 rounded-2xl border border-red-100 bg-red-50/50 p-4">
    <div className="flex-shrink-0 relative">
      <div className="w-11 h-11 rounded-full bg-red-600 text-white flex items-center justify-center">
        {icon}
      </div>
      <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-gray-900 text-white text-xs font-bold flex items-center justify-center">
        {number}
      </span>
    </div>
    <div className="flex-1">
      <h4 className="font-bold text-gray-900 text-sm mb-1">{title}</h4>
      <p className="text-xs text-gray-600 leading-relaxed">{description}</p>
    </div>
  </div>
);

/**
 * دليل تشويقي بيوضح للمستخدم اللي معندوش كارت بنكي إزاي يطلّع كارت
 * فيزا مؤقت من رصيد محفظته (فودافون كاش) عشان يقدر يدفع فورًا عبر
 * Google Play Billing. مفيش أي طريقة دفع بديلة هنا — دي بس خطوات
 * لإنشاء فيزا حقيقية يستخدمها المستخدم داخل نفس شاشة الدفع الرسمية
 * بتاعة جوجل.
 */
const VodafoneCardGuide = ({ onBack }: VodafoneCardGuideProps) => (
  <motion.div
    initial={{ opacity: 0, x: 20 }}
    animate={{ opacity: 1, x: 0 }}
    exit={{ opacity: 0, x: 20 }}
    className="max-w-xl mx-auto px-6 py-6 space-y-5 text-right"
  >
    <div className="text-center space-y-2">
      <span className="inline-block text-4xl">🎟️</span>
      <h2 className="text-2xl font-extrabold text-gray-900">
        فيزا في أقل من دقيقة!
      </h2>
      <p className="text-sm text-gray-600 leading-relaxed">
        معندكش كارت بنكي؟ محفظة فودافون كاش بتحلّها في ثواني — كارت فيزا
        حقيقي بالكامل، تدفع بيه هنا فورًا من غير أي تعقيد.
      </p>
    </div>

    <div className="space-y-3">
      <Step
        icon={<Smartphone className="w-5 h-5" />}
        number={1}
        title='افتح تطبيق "أنا فودافون"'
        description="من على موبايلك مباشرة، مفيش تسجيل جديد ولا بيانات إضافية."
      />
      <Step
        icon={<Wallet className="w-5 h-5" />}
        number={2}
        title="ادخل على فودافون كاش"
        description='من القائمة الرئيسية للتطبيق، اختار "فودافون كاش" ثم "الدفع أونلاين".'
      />
      <Step
        icon={<CreditCard className="w-5 h-5" />}
        number={3}
        title="حدد المبلغ واستلم كارتك"
        description="اكتب قيمة المنتج اللي هتشتريه (30 أو 50 جنيهًا)، وهيطلعلك كارت فيزا كامل البيانات فورًا."
      />
      <Step
        icon={<Timer className="w-5 h-5" />}
        number={4}
        title="ارجع واستخدمه على طول"
        description="الكارت صالح 24 ساعة لعمليتين دفع — ارجع لهنا واستخدم بياناته في شاشة الدفع، وخلاص هتفتح ميزتك فورًا 🎉"
      />
    </div>

    <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800 leading-relaxed text-center">
      💡 آمن 100% — ولو فضل رصيد من الكارت بعد الاستخدام، بيرجعلك تلقائيًا
      لمحفظتك تاني.
    </div>

    <button
      type="button"
      onClick={onBack}
      className="w-full py-3 rounded-xl bg-white border-2 border-gray-900 text-gray-900 font-extrabold flex items-center justify-center gap-2 transition-colors hover:bg-gray-50"
    >
      <ArrowRight className="w-4 h-4" />
      رجوع لصفحة الدفع
    </button>
  </motion.div>
);

export default VodafoneCardGuide;
