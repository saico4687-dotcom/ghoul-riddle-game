import { motion } from "framer-motion";
import { Trophy, LogIn, ArrowRight } from "lucide-react";
import { googleLogin } from "@/lib/medianAuth";
import { useState } from "react";

interface GoogleLoginScreenProps {
  onBack: () => void;
}

const GoogleLoginScreen = ({ onBack }: GoogleLoginScreenProps) => {
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      await googleLogin(window.location.origin);
    } catch (err) {
      console.error("Login failed:", err);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-horror-gradient relative overflow-hidden flex items-center justify-center">
      <div className="vignette" />
      <div className="fog-overlay" />

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative z-10 card-horror p-8 max-w-md w-full mx-4 text-center"
      >
        <motion.div
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="mb-6"
        >
          <Trophy className="w-16 h-16 mx-auto text-primary flicker" />
        </motion.div>

        <h2 className="font-horror text-4xl text-primary mb-4">ابدأ الألغاز</h2>

        <p className="font-typewriter text-foreground/80 mb-8">
          سجّل دخولك بحساب Google لحفظ تقدّمك ونتائجك
        </p>

        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-foreground/90 hover:bg-foreground text-background font-typewriter text-lg rounded-lg transition-all duration-300 disabled:opacity-50 mb-4"
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-background border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <LogIn className="w-5 h-5" />
              <span>تسجيل الدخول بـ Google</span>
            </>
          )}
        </button>

        <button
          onClick={onBack}
          className="flex items-center justify-center gap-2 mx-auto font-typewriter text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowRight className="w-4 h-4" />
          <span>العودة للقائمة الرئيسية</span>
        </button>
      </motion.div>
    </div>
  );
};

export default GoogleLoginScreen;
