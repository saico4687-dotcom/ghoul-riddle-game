import { motion } from "framer-motion";
import HorrorButton from "./HorrorButton";
import { Skull, Trophy, Ghost, Star, Zap } from "lucide-react";
import { GameMode } from "./WelcomeScreen";

interface ResultScreenProps {
  score: number;
  totalQuestions: number;
  totalPoints: number;
  maxPoints: number;
  timeBonus: number;
  rank: { title: string; color: string };
  gameMode: GameMode;
  onRestart: () => void;
}

const ResultScreen = ({
  score,
  totalQuestions,
  totalPoints,
  maxPoints,
  timeBonus,
  rank,
  onRestart,
}: ResultScreenProps) => {
  const percentage = (score / totalQuestions) * 100;
  const pointsPercentage = (totalPoints / maxPoints) * 100;

  const getMessage = () => {
    if (percentage === 100) return { title: "عبقري الرعب! 🏆", subtitle: "أنت سيد الألغاز المرعبة!" };
    if (percentage >= 70) return { title: "مخيف جداً! 👻", subtitle: "أداء رائع في عالم الرعب" };
    if (percentage >= 50) return { title: "لا بأس! 💀", subtitle: "تحتاج المزيد من الشجاعة" };
    return { title: "مرعوب! 😱", subtitle: "الألغاز أخافتك!" };
  };

  const { title, subtitle } = getMessage();

  return (
    <div className="min-h-screen bg-horror-gradient relative overflow-hidden flex items-center justify-center">
      <div className="vignette" />
      <div className="fog-overlay" />

      {[...Array(5)].map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 100 }}
          animate={{ opacity: [0, 0.3, 0], y: [-100, -500], x: Math.sin(i) * 100 }}
          transition={{ duration: 4, repeat: Infinity, delay: i * 0.8, ease: "easeOut" }}
          className="absolute bottom-0 text-primary/20"
          style={{ left: `${20 + i * 15}%` }}
        >
          <Skull className="w-12 h-12" />
        </motion.div>
      ))}

      <div className="relative z-10 text-center px-4 max-w-2xl py-8" dir="rtl">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", duration: 0.8 }}>
          {percentage >= 70 ? (
            <Trophy className="w-24 h-24 mx-auto text-primary mb-8 flicker" />
          ) : (
            <Ghost className="w-24 h-24 mx-auto text-primary mb-8 flicker" />
          )}
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="font-horror text-5xl md:text-7xl text-blood pulse-blood mb-4"
        >
          {title}
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="font-typewriter text-xl text-foreground/80 mb-4"
        >
          {subtitle}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.6 }}
          className="mb-6"
        >
          <p className="font-typewriter text-muted-foreground mb-2">ترتيبك:</p>
          <p className={`font-horror text-3xl ${rank.color}`}>{rank.title}</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.7 }}
          className="grid grid-cols-2 gap-4 mb-8"
        >
          <div className="card-horror p-4">
            <Star className="w-8 h-8 mx-auto text-yellow-400 mb-2" />
            <div className="font-horror text-4xl text-primary">{score}/{totalQuestions}</div>
            <div className="font-typewriter text-sm text-muted-foreground">إجابات صحيحة</div>
          </div>
          <div className="card-horror p-4">
            <Zap className="w-8 h-8 mx-auto text-yellow-400 mb-2" />
            <div className="font-horror text-4xl text-primary">{totalPoints}</div>
            <div className="font-typewriter text-sm text-muted-foreground">إجمالي النقاط</div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.85 }}
          className="card-horror p-4 mb-8"
        >
          <p className="font-typewriter text-sm text-muted-foreground mb-1">نسبة الإتقان</p>
          <p className="font-horror text-2xl text-primary">{pointsPercentage.toFixed(1)}%</p>
          {timeBonus > 0 && (
            <p className="font-typewriter text-xs text-muted-foreground mt-2">
              ⚡ نقاط السرعة الإضافية: {timeBonus}
            </p>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1 }}
          className="card-horror p-4 mb-6 border-primary/40"
        >
          <p className="font-typewriter text-sm text-foreground/90 leading-relaxed">
            🔒 لقد أكملت جميع الألغاز الـ 400. تم حفظ نتيجتك النهائية ولا يمكن إعادة المحاولة.
          </p>
        </motion.div>

        <HorrorButton onClick={onRestart}>العودة للقائمة الرئيسية</HorrorButton>
      </div>
    </div>
  );
};

export default ResultScreen;
