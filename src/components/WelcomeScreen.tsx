import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Brain, Lightbulb, Sparkles, Trophy, Settings as SettingsIcon } from "lucide-react";
import heroImage from "@/assets/hero-horror.jpg";

export type GameMode = "competition";

interface WelcomeScreenProps {
  onStart: (mode: GameMode) => void;
}

const WelcomeScreen = ({ onStart }: WelcomeScreenProps) => {
  return (
    <div className="min-h-screen bg-horror-gradient relative overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center opacity-10"
        style={{ backgroundImage: `url(${heroImage})` }}
      />

      <Link
        to="/settings"
        aria-label="الإعدادات"
        className="absolute top-4 left-4 z-20 p-2 rounded-full bg-card/70 border border-primary/40 text-primary hover:bg-card hover:scale-110 transition-all backdrop-blur-sm"
      >
        <SettingsIcon className="w-5 h-5" />
      </Link>

      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4 text-center">
        <motion.div
          animate={{ y: [0, -20, 0], rotate: [0, 5, -5, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          className="hidden sm:block absolute top-20 left-10 text-primary/40"
        >
          <Lightbulb className="w-16 h-16" />
        </motion.div>

        <motion.div
          animate={{ y: [0, 15, 0], rotate: [0, -5, 5, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          className="hidden sm:block absolute top-32 right-16 text-accent/40"
        >
          <Sparkles className="w-12 h-12" />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1 }}
          className="max-w-2xl"
        >
          <motion.div
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            className="mb-8"
          >
            <Brain className="w-24 h-24 mx-auto text-primary drop-shadow-[0_0_20px_hsl(var(--primary)/0.7)]" />
          </motion.div>

          <h1 className="font-horror text-5xl sm:text-6xl md:text-8xl text-primary mb-6 drop-shadow-[0_4px_20px_hsl(var(--primary)/0.5)]">
            Come Bound
          </h1>

          <p className="font-typewriter text-xl md:text-2xl text-foreground mb-4">
            حفّز عقلك وانطلق في رحلة الألغاز الممتعة!
          </p>

          <p className="font-typewriter text-lg text-foreground/80 mb-8">
            400 لغز ذكي ينتظر عقلك الحاد
          </p>

          <div className="flex flex-wrap justify-center gap-4 mb-8">
            <motion.div whileHover={{ scale: 1.05 }} className="card-horror px-5 py-3 flex items-center gap-3">
              <Brain className="w-6 h-6 text-primary" />
              <span className="font-typewriter text-foreground">ركّز قبل الإجابة</span>
            </motion.div>
            <motion.div whileHover={{ scale: 1.05 }} className="card-horror px-5 py-3 flex items-center gap-3">
              <Lightbulb className="w-6 h-6 text-accent" />
              <span className="font-typewriter text-foreground">فكّر خارج الصندوق</span>
            </motion.div>
            <motion.div whileHover={{ scale: 1.05 }} className="card-horror px-5 py-3 flex items-center gap-3">
              <Sparkles className="w-6 h-6 text-primary" />
              <span className="font-typewriter text-foreground">اقرأ السؤال بتأنّي</span>
            </motion.div>
          </div>

          <div className="flex justify-center mb-8">
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <button
                onClick={() => onStart("competition")}
                className="w-full sm:w-auto flex items-center justify-center gap-3 px-12 py-5 bg-gradient-to-r from-primary via-yellow-400 to-primary text-primary-foreground font-horror text-2xl rounded-xl border-2 border-primary shadow-[0_8px_30px_hsl(var(--primary)/0.5)] hover:shadow-[0_8px_40px_hsl(var(--primary)/0.8)] transition-all duration-300"
              >
                <Trophy className="w-7 h-7" />
                <span>ابدأ الألغاز (400)</span>
              </button>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.5 }}
            className="card-horror p-4 inline-block"
          >
            <p className="font-typewriter text-sm text-foreground">
              🏆 اجمع النقاط واحصل على ترتيبك!
            </p>
            <p className="font-typewriter text-xs text-foreground/70 mt-1">
              +10 نقاط لكل إجابة صحيحة | +5 نقاط إضافية للسرعة
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.8 }}
            className="mt-8 flex items-center justify-center gap-6"
          >
            <Link
              to="/settings"
              className="font-typewriter text-base text-foreground hover:text-primary transition-colors"
            >
              الإعدادات
            </Link>
            <span className="text-foreground/40">|</span>
            <Link
              to="/privacy"
              className="font-typewriter text-base text-foreground hover:text-primary transition-colors"
            >
              سياسة الخصوصية
            </Link>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
};

export default WelcomeScreen;
