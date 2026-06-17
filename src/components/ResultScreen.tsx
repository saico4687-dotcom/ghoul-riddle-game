import { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import HorrorButton from "./HorrorButton";
import { Brain, Trophy, Sparkles, Star, Calendar, Hourglass, LogOut, Home, MessageCircle, Lock, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";


interface ResultScreenProps {
  score: number;
  totalQuestions: number;
  totalPoints: number;
  maxPoints: number;
  timeBonus: number;
  rank: { title: string; color: string };
  completed?: boolean;
  onRestart: () => void;
  onLogout?: () => void;
}

const ResultScreen = ({
  score,
  totalQuestions,
  totalPoints,
  maxPoints,
  rank,
  completed = false,
  onRestart,
  onLogout,
}: ResultScreenProps) => {
  const percentage = totalQuestions ? (score / totalQuestions) * 100 : 0;
  const pointsPercentage = maxPoints ? (totalPoints / maxPoints) * 100 : 0;
  const navigate = useNavigate();
  const { user } = useAuth();
  const [openingChat, setOpeningChat] = useState(false);

  const openChat = async () => {
    if (!user) {
      toast.error("سجّل الدخول أولاً لفتح الدردشة");
      return;
    }
    setOpeningChat(true);
    try {
      // Ensure the server-side completion flag is set (covers any earlier silent failure)
      const { data: before } = await supabase
        .from("profiles")
        .select("user_id, username, completed")
        .eq("user_id", user.id)
        .maybeSingle();
      console.log("[chat-open] current profile", before);

      let isCompleted = before?.completed === true;
      if (!isCompleted) {
        const { data: upd, error } = await supabase
          .from("profiles")
          .update({ completed: true, completed_at: new Date().toISOString() })
          .eq("user_id", user.id)
          .select("completed, username")
          .maybeSingle();
        console.log("[chat-open] forced completion", { upd, error });
        if (error) {
          toast.error("تعذر تفعيل الدردشة: " + error.message);
          setOpeningChat(false);
          return;
        }
        isCompleted = upd?.completed === true;
      }

      const dest = before?.username ? "/chat" : "/chat/setup";
      console.log("[chat-open] navigating to", dest);
      navigate(dest);
    } finally {
      setOpeningChat(false);
    }
  };

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
          <span className="font-horror text-primary">إنجازك في الألغاز</span>
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
            <Trophy className="w-8 h-8 mx-auto text-primary mb-2" />
            <div className="font-horror text-4xl text-primary">{pointsPercentage.toFixed(0)}%</div>
            <div className="font-typewriter text-sm text-foreground/80">نسبة الإتقان</div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9 }}
          className="card-horror p-5 mb-6 border-primary/40 text-right"
        >
          <div className="flex items-center gap-2 mb-2 justify-center">
            <Hourglass className="w-5 h-5 text-primary" />
            <h3 className="font-horror text-xl text-primary">ملخّص تقدمك</h3>
          </div>
          <p className="font-typewriter text-sm text-foreground leading-relaxed">
            أنهيت هذه الجولة بنجاح. يمكنك العودة للرئيسية ثم البدء من جديد
            إذا أردت إعادة حلّ الألغاز وتحسين نتيجتك.
          </p>
          <p className="font-typewriter text-xs text-foreground/70 mt-2 text-center">
            بالتوفيق 🌟
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1 }}
          className="card-horror p-4 mb-6 border-primary/40"
        >
          {completed ? (
            <>
              <p className="font-horror text-2xl text-primary mb-3 text-center">
                🏆 تم إكمال جميع الألغاز بنجاح
              </p>
              <p className="font-typewriter text-sm text-foreground leading-relaxed text-center">
                الفائزون يتم اختيارهم بناءً على أسرع إجابة صحيحة، ويتم إعلان
                الفائزين والتواصل معهم أسبوعياً.
              </p>
            </>
          ) : (
            <p className="font-typewriter text-sm text-foreground leading-relaxed">
              ✅ أكملت مجموعة الألغاز الحالية على هذا الحساب.
            </p>
          )}
        </motion.div>

        <div className="flex flex-col gap-3">
          {completed ? (
            <button
              onClick={openChat}
              disabled={openingChat}
              className="w-full font-horror text-xl py-4 rounded-xl bg-gradient-to-l from-primary to-accent text-primary-foreground shadow-[0_0_30px_hsl(var(--primary)/0.6)] hover:scale-105 transition-transform flex items-center justify-center gap-3 border-2 border-primary-foreground/20 disabled:opacity-70"
            >
              {openingChat ? <Loader2 className="w-6 h-6 animate-spin" /> : <MessageCircle className="w-6 h-6" />}
              ادخل الدردشة
            </button>
          ) : (
            <div className="w-full py-3 rounded-xl border-2 border-dashed border-muted-foreground/40 text-muted-foreground text-center font-typewriter text-sm flex items-center justify-center gap-2">
              <Lock className="w-4 h-4" />
              أكمل 400 لغز لفتح الدردشة
            </div>
          )}

          <HorrorButton onClick={onRestart}>
            <Home className="w-5 h-5 ml-2 inline" />
            العودة للقائمة الرئيسية
          </HorrorButton>
          {onLogout && (
            <button
              onClick={onLogout}
              className="font-typewriter text-sm text-primary/80 hover:text-primary underline-offset-4 hover:underline inline-flex items-center justify-center gap-2 py-2"
            >
              <LogOut className="w-4 h-4" />
              العودة بحساب آخر
            </button>
          )}
        </div>

      </div>
    </div>
  );
};

export default ResultScreen;
