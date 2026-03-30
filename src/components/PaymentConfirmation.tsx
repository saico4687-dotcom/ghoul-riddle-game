import { motion } from "framer-motion";
import HorrorButton from "@/components/HorrorButton";

interface PaymentConfirmationProps {
  onConfirm: () => void;
}

const PaymentConfirmation = ({ onConfirm }: PaymentConfirmationProps) => {
  return (
    <div className="min-h-screen bg-horror-gradient flex items-center justify-center px-4" dir="rtl">
      <div className="vignette" />

      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", damping: 20, stiffness: 200 }}
        className="w-full max-w-sm card-horror p-8 z-10 text-center"
      >
        <motion.div
          animate={{ rotate: [0, 5, -5, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="text-5xl mb-6"
        >
          💰
        </motion.div>

        <p className="font-typewriter text-foreground text-base leading-relaxed mb-8">
          للدخول في السحب يجب أن تحتوي محفظة فودافون كاش على 50 جنيهاً مصرياً على الأقل.
        </p>

        <div className="card-horror p-4 mb-6 text-sm font-typewriter">
          <p className="text-muted-foreground mb-1">رقم الهاتف</p>
          <p className="text-primary text-lg font-horror" dir="ltr">01062612970</p>
          <p className="text-muted-foreground mt-2 mb-1">المبلغ</p>
          <p className="text-primary text-lg font-horror">50 جنيه مصري</p>
        </div>

        <HorrorButton
          onClick={() => {
            window.open(
              "https://accept.paymob.com/standalone/?ref=i_LRR2TTRHcjc0c0tBM0VuNUJhcThRNWJCUT09X0tWTUt0d3RVQXI4MENKRVVDZmJqdVE9PQ",
              "_blank"
            );
            onConfirm();
          }}
          className="w-full text-xl"
        >
          ✅ موافق
        </HorrorButton>
      </motion.div>
    </div>
  );
};

export default PaymentConfirmation;
