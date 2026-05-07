import { motion } from "framer-motion";
import HorrorButton from "./HorrorButton";
import { Brain, Trophy, Sparkles, Star, Calendar, Hourglass } from "lucide-react";
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
  rank,
  onRestart,
}: ResultScreenProps) => {
  const percentage = totalQuestions ? (score / totalQuestions) * 100 : 0;
  const pointsPercentage = maxPoints ? (totalPoints / maxPoints) * 100 : 0;

  const getMessage = () => {
    if (percentage === 100) return { title: "عبقري الألغاز! 🏆", subtitle: "أداء استثنائي ومذهل!" };
    if (percentage >= 70) return { title: "رائع جداً! ✨", subtitle: "عقل حاد وتفكير متميّز" };
    if (percentage >= 50) return { title: "أداء جيد! 💡", subtitle: "استمر في تنمية مهاراتك" };
    return { title: "بداية جيدة! 🌱", subtitle: "التدريب يصنع الإتقان" };
  };

  const { title, subtitle } = getMessage();

  return (
    <div className="min-h-screen bg-horror-gradient relative overflow-hidden flex items-start justify-center">
      {[...Array(5)].map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 100 }}
          animate={{ opacity: [0, 0.3, 0], y: [-100, -500], x: Math.sin(i) * 100 }}
          transition={{ duration: 4, repeat: Infinity, delay: i * 0.8, ease: "easeOut" }}
          className="absolute bottom-0 text-primary/30"
          style={{ left: `${20 + i * 15}%` }}
        >
          <Sparkles className="w-12 h-12" />
        </motion.div>
      ))}

      <div className="relative z-10 text-center px-4 max-w-2xl py-8 w-full" dir="rtl">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="card-horror p-3 mb-6 inline-flex items-center gap-2 border-primary/40"
        >
          <Calendar className="w-5 h-5 text-primary" />
          <span className="font-horror text-primary">المسابقة الأسبوعية</span>
        </motion.div>

        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", duration: 0.8 }}>
          {percentage >= 70 ? (
            <Trophy className="w-24 h-24 mx-auto text-primary mb-8" />
          ) : (
            <Brain className="w-24 h-24 mx-auto text-primary mb-8" />
          )}
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="font-horror text-5xl md:text-7xl text-primary mb-4 drop-shadow-[0_4px_20px_hsl(var(--primary)/0.5)]"
        >
          {title}
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="font-typewriter text-xl text-foreground mb-4"
        >
          {subtitle}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.6 }}
          className="mb-6"
        >
          <p className="font-typewriter text-foreground/80 mb-2">ترتيبك:</p>
          <p className={`font-horror text-3xl ${rank.color}`}>{rank.title}</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.7 }}
          className="grid grid-cols-2 gap-4 mb-8"
        >
          <div className="card-horror p-4">
            <Star className="w-8 h-8 mx-auto text-primary mb-2" />
            <div className="font-horror text-4xl text-primary">{score}/{totalQuestions}</div>
            <div className="font-typewriter text-sm text-foreground/80">إجابات صحيحة</div>
          </div>
          <div className="card-horror p-4">
            <Zap className="w-8 h-8 mx-auto text-primary mb-2" />
            <div className="font-horror text-4xl text-primary">{totalPoints}</div>
            <div className="font-typewriter text-sm text-foreground/80">إجمالي النقاط</div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.85 }}
          className="card-horror p-4 mb-8"
        >
          <p className="font-typewriter text-sm text-foreground/80 mb-1">نسبة الإتقان</p>
          <p className="font-horror text-2xl text-primary">{pointsPercentage.toFixed(1)}%</p>
          {timeBonus > 0 && (
            <p className="font-typewriter text-xs text-foreground/70 mt-2">
              ⚡ نقاط السرعة الإضافية: {timeBonus}
            </p>
          )}
        </motion.div>

        {answers.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.95 }}
            className="card-horror p-4 mb-8 text-right"
          >
            <h2 className="font-horror text-2xl text-primary mb-4 text-center">
              مراجعة الإجابات
            </h2>
            <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
              {answers.map((a, idx) => {
                const isCorrect = a.selected === a.correct;
                return (
                  <div
                    key={idx}
                    className="border border-primary/20 rounded-lg p-3 bg-background/40"
                  >
                    <div className="flex items-start gap-2 mb-2">
                      <span className="font-horror text-primary text-sm shrink-0">
                        {idx + 1}.
                      </span>
                      <p className="font-typewriter text-sm text-foreground leading-relaxed">
                        {a.q}
                      </p>
                    </div>
                    <div className="space-y-1 mb-2">
                      <div className="flex items-center gap-2">
                        {isCorrect ? (
                          <Check className="w-4 h-4 text-green-400 shrink-0" />
                        ) : (
                          <X className="w-4 h-4 text-red-400 shrink-0" />
                        )}
                        <span className="font-typewriter text-xs text-foreground/80">
                          إجابتك: {a.selected !== null ? a.options[a.selected] : "لم تجب"}
                        </span>
                      </div>
                      {!isCorrect && (
                        <div className="flex items-center gap-2">
                          <Check className="w-4 h-4 text-green-400 shrink-0" />
                          <span className="font-typewriter text-xs text-green-400">
                            الصحيحة: {a.options[a.correct]}
                          </span>
                        </div>
                      )}
                    </div>
                    <p className="font-typewriter text-xs text-foreground/70 leading-relaxed border-t border-primary/10 pt-2">
                      💡 {a.explanation}
                    </p>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1 }}
          className="card-horror p-4 mb-6 border-primary/40"
        >
          <p className="font-typewriter text-sm text-foreground leading-relaxed">
            🔒 لقد أكملت المسابقة الأسبوعية. لا يمكن إعادة فتح الألغاز على نفس
            الحساب. تابعنا لانتظار مسابقة الأسبوع القادم!
          </p>
        </motion.div>

        <HorrorButton onClick={onRestart}>العودة للقائمة الرئيسية</HorrorButton>
      </div>
    </div>
  );
};

export default ResultScreen;
