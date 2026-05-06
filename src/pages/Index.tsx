import { useState, useMemo, useEffect, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import WelcomeScreen, { GameMode } from "@/components/WelcomeScreen";
import RiddleCard from "@/components/RiddleCard";
import ResultScreen from "@/components/ResultScreen";
import GoogleLoginScreen from "@/components/GoogleLoginScreen";
import { riddles } from "@/data/riddles";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { showInterstitial } from "@/lib/ads";

type GameState = "welcome" | "login" | "playing" | "result";

const Index = () => {
  const [gameState, setGameState] = useState<GameState>("welcome");
  const [currentRiddleIndex, setCurrentRiddleIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [totalPoints, setTotalPoints] = useState(0);
  const [timeBonus, setTimeBonus] = useState(0);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [answers, setAnswers] = useState<Array<{ q: string; selected: number | null; correct: number; options: string[]; explanation: string }>>([]);
  const { user } = useAuth();

  const allRiddles = useMemo(() => riddles.slice(0, 400), []);

  const ensureProfile = useCallback(async () => {
    if (!user) return null;
    const { data } = await supabase
      .from("profiles")
      .select("last_puzzle_index, saved_score, saved_total_points, saved_time_bonus")
      .eq("user_id", user.id)
      .single();
    if (data) return data;
    const { data: newProfile } = await supabase
      .from("profiles")
      .insert({
        user_id: user.id,
        email: user.email,
        name: user.user_metadata?.full_name || user.user_metadata?.name || "",
        profile_image: user.user_metadata?.avatar_url || user.user_metadata?.picture || "",
      })
      .select("last_puzzle_index, saved_score, saved_total_points, saved_time_bonus")
      .single();
    return newProfile;
  }, [user]);

  const saveProgress = useCallback(
    async (newIndex: number, newScore: number, newTotalPoints: number, newTimeBonus: number) => {
      if (!user) return;
      await supabase
        .from("profiles")
        .update({
          last_puzzle_index: newIndex,
          saved_score: newScore,
          saved_total_points: newTotalPoints,
          saved_time_bonus: newTimeBonus,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);
    },
    [user]
  );

  const startFromProfile = useCallback(async () => {
    const data = await ensureProfile();
    const startIndex = data?.last_puzzle_index ?? 0;
    const savedScore = data?.saved_score ?? 0;
    const savedPoints = data?.saved_total_points ?? 0;
    const savedBonus = data?.saved_time_bonus ?? 0;

    setScore(savedScore);
    setTotalPoints(savedPoints);
    setTimeBonus(savedBonus);

    if (startIndex >= allRiddles.length) {
      // Locked — already finished
      setCurrentRiddleIndex(allRiddles.length);
      setGameState("result");
    } else {
      setCurrentRiddleIndex(startIndex);
      setGameState("playing");
    }
  }, [ensureProfile, allRiddles.length]);

  useEffect(() => {
    if (gameState === "login" && user) {
      startFromProfile();
    }
  }, [user, gameState, startFromProfile]);

  const handleStart = async (_mode: GameMode) => {
    if (!user) {
      setGameState("login");
      return;
    }
    await startFromProfile();
  };

  const handleAnswer = (isCorrect: boolean, selectedIndex: number | null, remainingTime?: number) => {
    let newScore = score;
    let newTotalPoints = totalPoints;
    let newTimeBonus = timeBonus;

    if (isCorrect) {
      newScore = score + 1;
      setScore(newScore);
      let points = 10;
      if (remainingTime !== undefined && remainingTime > 0) {
        const bonus = Math.min(5, Math.floor(remainingTime / 12));
        points += bonus;
        newTimeBonus = timeBonus + bonus;
        setTimeBonus(newTimeBonus);
      }
      newTotalPoints = totalPoints + points;
      setTotalPoints(newTotalPoints);
    }

    const r = allRiddles[currentRiddleIndex];
    setAnswers((prev) => [
      ...prev,
      {
        q: r.question,
        selected: selectedIndex,
        correct: r.correctIndex,
        options: r.options,
        explanation: r.explanation,
      },
    ]);

    // Interstitial every 5 answered questions
    const newAnswered = answeredCount + 1;
    if (newAnswered >= 5) {
      showInterstitial();
      setAnsweredCount(0);
    } else {
      setAnsweredCount(newAnswered);
    }

    if (user) {
      const nextIndex = currentRiddleIndex + 1;
      saveProgress(nextIndex, newScore, newTotalPoints, newTimeBonus);
    }
  };

  const handleNext = () => {
    if (currentRiddleIndex < allRiddles.length - 1) {
      setCurrentRiddleIndex(currentRiddleIndex + 1);
    } else {
      // Mark fully completed
      if (user) saveProgress(allRiddles.length, score, totalPoints, timeBonus);
      setGameState("result");
    }
  };

  const handleRestart = () => {
    // Locked: just go back to welcome (no reset of completed state)
    setGameState("welcome");
  };

  const getRank = (points: number, totalPossible: number) => {
    const percentage = (points / totalPossible) * 100;
    if (percentage >= 90) return { title: "أسطورة الذكاء 👑", color: "text-yellow-400" };
    if (percentage >= 75) return { title: "سيد الألغاز 🏆", color: "text-purple-400" };
    if (percentage >= 60) return { title: "محقق ماهر 🔍", color: "text-blue-400" };
    if (percentage >= 45) return { title: "مفكّر شجاع ⚔️", color: "text-green-400" };
    if (percentage >= 30) return { title: "مبتدئ واعد 📚", color: "text-orange-400" };
    return { title: "في بداية الطريق 🌱", color: "text-pink-400" };
  };

  const maxPoints = allRiddles.length * 15;
  const rank = getRank(totalPoints, maxPoints);

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <AnimatePresence mode="wait">
        {gameState === "welcome" && (
          <motion.div key="welcome" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <WelcomeScreen onStart={handleStart} />
          </motion.div>
        )}

        {gameState === "login" && (
          <motion.div key="login" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <GoogleLoginScreen onBack={() => setGameState("welcome")} />
          </motion.div>
        )}

        {gameState === "playing" && (
          <motion.div
            key="playing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="min-h-screen bg-horror-gradient py-8"
          >
            <div className="vignette" />

            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="fixed top-4 left-4 z-50 card-horror px-4 py-2"
            >
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <p className="font-typewriter text-xs text-muted-foreground">النقاط</p>
                  <p className="font-horror text-2xl text-primary">{totalPoints}</p>
                </div>
                <div className="w-px h-8 bg-primary/30" />
                <div className="text-center">
                  <p className="font-typewriter text-xs text-muted-foreground">الترتيب</p>
                  <p className={`font-horror text-sm ${rank.color}`}>{rank.title}</p>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="fixed top-4 right-4 z-50 flex items-center gap-3"
            >
              {user && (
                <div className="card-horror px-3 py-2 flex items-center gap-2">
                  {user.user_metadata?.avatar_url || user.user_metadata?.picture ? (
                    <img
                      src={user.user_metadata.avatar_url || user.user_metadata.picture}
                      alt="avatar"
                      className="w-8 h-8 rounded-full border border-primary/50"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-primary/30 flex items-center justify-center font-horror text-sm text-primary-foreground">
                      {(user.user_metadata?.full_name || user.user_metadata?.name || user.email || "?")[0]}
                    </div>
                  )}
                  <span className="font-typewriter text-xs text-foreground max-w-[100px] truncate">
                    {user.user_metadata?.full_name || user.user_metadata?.name || user.email}
                  </span>
                </div>
              )}
              <div className="px-4 py-2 rounded-lg font-horror text-sm bg-primary/20 text-primary border border-primary/50">
                🏆 الألغاز
              </div>
            </motion.div>

            <div className="pt-16">
              <RiddleCard
                riddle={allRiddles[currentRiddleIndex]}
                riddleNumber={currentRiddleIndex + 1}
                totalRiddles={allRiddles.length}
                onAnswer={handleAnswer}
                onNext={handleNext}
                gameMode="competition"
              />
            </div>
          </motion.div>
        )}

        {gameState === "result" && (
          <motion.div key="result" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <ResultScreen
              score={score}
              totalQuestions={allRiddles.length}
              totalPoints={totalPoints}
              maxPoints={maxPoints}
              timeBonus={timeBonus}
              rank={rank}
              gameMode="competition"
              onRestart={handleRestart}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Index;
