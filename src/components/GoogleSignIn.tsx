import { motion } from "framer-motion";
import { Skull, Trophy, LogIn } from "lucide-react";

interface GoogleSignInProps {
  onSignIn: () => Promise<any>;
  loading?: boolean;
}

const GoogleSignIn = ({ onSignIn, loading }: GoogleSignInProps) => {
  return (
    <div className="min-h-screen bg-horror-gradient relative overflow-hidden flex items-center justify-center">
      <div className="vignette" />
      <div className="fog-overlay" />

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative z-10 max-w-md w-full mx-4"
      >
        <div className="card-horror p-8 text-center">
          <motion.div
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="mb-6"
          >
            <Skull className="w-16 h-16 mx-auto text-primary flicker" />
          </motion.div>

          <h2 className="font-horror text-3xl text-blood pulse-blood mb-4">
            ألغاز المسابقة
          </h2>

          <div className="flex items-center justify-center gap-2 mb-6">
            <Trophy className="w-5 h-5 text-yellow-400" />
            <p className="font-typewriter text-muted-foreground">
              سجّل دخولك للمشاركة في المسابقة
            </p>
          </div>

          <button
            onClick={onSignIn}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-horror-blood to-red-900 hover:from-red-600 hover:to-red-800 text-white font-horror text-lg rounded-lg border-2 border-red-500 shadow-lg shadow-red-900/50 transition-all duration-300 disabled:opacity-50"
          >
            <LogIn className="w-5 h-5" />
            <span>{loading ? "جاري التحميل..." : "تسجيل الدخول بجوجل"}</span>
          </button>

          <p className="font-typewriter text-xs text-muted-foreground mt-4">
            سيتم حفظ تقدمك تلقائياً
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default GoogleSignIn;
