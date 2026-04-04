import { motion } from "framer-motion";
import HorrorButton from "./HorrorButton";
import { Skull, Trophy, RotateCcw, Ghost, Star, Zap } from "lucide-react";
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
  gameMode,
  onRestart 
}: ResultScreenProps) => {
  const percentage = (score / totalQuestions) * 100;
  const pointsPercentage = (totalPoints / maxPoints) * 100;
  
  const getMessage = () => {
    if (percentage === 100) {
      return { title: "عبقري الرعب! 🏆", subtitle: "أنت سيد الألغاز المرعبة!" };
    } else if (percentage >= 70) {
      return { title: "مخيف جداً! 👻", subtitle: "أداء رائع في عالم الرعب" };
    } else if (percentage >= 50) {
      return { title: "لا بأس! 💀", subtitle: "تحتاج المزيد من الشجاعة" };
    } else {
      return { title: "مرعوب! 😱", subtitle: "الألغاز أخافتك!" };
    }
  };

  const { title, subtitle } = getMessage();

  return (
    <div className="min-h-screen bg-horror-gradient relative overflow-hidden flex items-center justify-center">
      {/* Vignette */}
      <div className="vignette" />
      
      {/* Fog Overlay */}
      <div className="fog-overlay" />

      {/* Floating Skulls */}
      {[...Array(5)].map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 100 }}
          animate={{
            opacity: [0, 0.3, 0],
            y: [-100, -500],
            x: Math.sin(i) * 100,
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            delay: i * 0.8,
            ease: "easeOut",
          }}
          className="absolute bottom-0 text-primary/20"
          style={{ left: `${20 + i * 15}%` }}
        >
          <Skull className="w-12 h-12" />
        </motion.div>
      ))}

      <div className="relative z-10 text-center px-4 max-w-2xl">
        {/* Game Mode Badge */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <div className={`inline-block px-6 py-2 rounded-lg font-horror text-lg ${
            gameMode === "fun" 
              ? "bg-green-900/80 text-green-300 border border-green-500" 
              : "bg-red-900/80 text-red-300 border border-red-500"
          }`}>
            {gameMode === "fun" ? "🎮 ألغاز المتعة" : "🏆 ألغاز المسابقة"}
          </div>
        </motion.div>

        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", duration: 0.8 }}
        >
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

        {/* Rank Display */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.6 }}
          className="mb-6"
        >
          <p className="font-typewriter text-muted-foreground mb-2">ترتيبك:</p>
          <p className={`font-horror text-3xl ${rank.color}`}>{rank.title}</p>
        </motion.div>

        {/* Stats Cards */}
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
            <Trophy className="w-8 h-8 mx-auto text-purple-400 mb-2" />
            <div className="font-horror text-4xl text-primary">{totalPoints}</div>
            <div className="font-typewriter text-sm text-muted-foreground">نقطة</div>
          </div>
        </motion.div>

        {/* Time Bonus */}
        {timeBonus > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="card-horror p-3 mb-6 inline-flex items-center gap-2"
          >
            <Zap className="w-5 h-5 text-yellow-400" />
            <span className="font-typewriter text-sm text-yellow-400">
              +{timeBonus} نقاط إضافية للسرعة!
            </span>
          </motion.div>
        )}

        {/* Score Bar */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9 }}
          className="w-full max-w-md mx-auto mb-8"
        >
          <div className="h-4 bg-secondary rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${pointsPercentage}%` }}
              transition={{ delay: 1, duration: 1.5, ease: "easeOut" }}
              className="h-full bg-gradient-to-r from-horror-blood to-primary"
              style={{
                boxShadow: "0 0 15px hsl(var(--horror-glow) / 0.5)",
              }}
            />
          </div>
          <p className="font-typewriter text-muted-foreground mt-2">
            {totalPoints} / {maxPoints} نقطة ممكنة
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.2 }}
        >
          <HorrorButton onClick={onRestart}>
            <span className="flex items-center gap-3">
              <RotateCcw className="w-5 h-5" />
              العودة للقائمة الرئيسية
            </span>
          </HorrorButton>
        </motion.div>
      </div>
    </div>
  );
};

export default ResultScreen;