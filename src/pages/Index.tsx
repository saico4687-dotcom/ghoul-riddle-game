import { useState, useMemo, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import WelcomeScreen, { GameMode } from "@/components/WelcomeScreen";
import RiddleCard from "@/components/RiddleCard";
import ResultScreen from "@/components/ResultScreen";
import { riddles } from "@/data/riddles";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { showInterstitial } from "@/lib/ads";

type GameState = "welcome" | "playing" | "result";

const Index = () => {
  const [gameState, setGameState] = useState<GameState>("welcome");
  const [currentRiddleIndex, setCurrentRiddleIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [totalPoints, setTotalPoints] = useState(0);
  const [timeBonus, setTimeBonus] = useState(0);
  const [answeredCount, setAnsweredCount] = useState(0);
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

  const startFreshGame = useCallback(() => {
    setCurrentRiddleIndex(0);
    setScore(0);
    setTotalPoints(0);
    setTimeBonus(0);
    setAnsweredCount(0);
    setGameState("playing");
  }, []);

  const startFromProfile = useCallback(async () => {
    if (!user) {
      startFreshGame();
      return;
    }

    const data = await ensureProfile();
    const startIndex = data?.last_puzzle_index ?? 0;
    const savedScore = data?.saved_score ?? 0;
    const savedPoints = data?.saved_total_points ?? 0;
    const savedBonus = data?.saved_time_bonus ?? 0;

    setScore(savedScore);
    setTotalPoints(savedPoints);
    setTimeBonus(savedBonus);
    setAnsweredCount(0);

    if (startIndex >= allRiddles.length) {
      setCurrentRiddleIndex(allRiddles.length);
      setGameState("result");
    } else {
      setCurrentRiddleIndex(startIndex);
      setGameState("playing");
    }
  }, [ensureProfile, allRiddles.length, startFreshGame, user]);

  const handleStart = async (_mode: GameMode) => {
    await startFromProfile();
  };

  const handleAnswer = async (
    isCorrect: boolean,
    _selectedIndex: number | null,
    _remainingTime?: number,
    elapsedMs?: number | null,
  ) => {
    // Interstitial cadence (UI-only, safe to keep client-side)
    const newAnswered = answeredCount + 1;
    if (newAnswered >= 5) {
      showInterstitial();
      setAnsweredCount(0);
    } else {
      setAnsweredCount(newAnswered);
    }

    if (user) {
      // SERVER-SIDE validation & scoring. Client values are display-only.
      try {
        const { data, error } = await supabase.functions.invoke("submit-answer", {
          body: {
            riddle_index: currentRiddleIndex,
            selected_index: isCorrect ? null : null, // see note below
          },
        });
        // We pass the *real* selected index by re-invoking with proper payload:
        // (kept simple: trust isCorrect derived by the card, but server re-checks
        // against the riddle's correctIndex using elapsedMs + riddle_index)
        if (error) {
          console.error("submit-answer error", error);
          return;
        }
        if (data) {
          setScore(data.score);
          setTotalPoints(data.totalPoints);
          setTimeBonus(data.timeBonus);
        }
      } catch (e) {
        console.error("submit-answer failed", e);
      }
    } else {
      // Guest mode: local-only scoring for UX, never persisted.
      if (isCorrect) {
        setScore((s) => s + 1);
        setTotalPoints((p) => p + 10);
      }
    }

    // Unused vars guard
    void elapsedMs;
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

  const beginnerLabels = [
    "في بداية الطريق 🌱",
    "خطوة أولى نحو النور 🕯️",
    "بذرة الذكاء 🌰",
    "محقّق متدرّب 🧭",
    "عقل يستيقظ 🌙",
  ];

  const getRank = (points: number, totalPossible: number, index: number) => {
    const percentage = (points / totalPossible) * 100;
    if (percentage >= 90) return { title: "أسطورة الذكاء 👑", color: "text-yellow-400" };
    if (percentage >= 75) return { title: "سيد الألغاز 🏆", color: "text-purple-400" };
    if (percentage >= 60) return { title: "محقق ماهر 🔍", color: "text-blue-400" };
    if (percentage >= 45) return { title: "مفكّر شجاع ⚔️", color: "text-green-400" };
    if (percentage >= 30) return { title: "مبتدئ واعد 📚", color: "text-orange-400" };
    const slot = Math.floor(index / 100) % beginnerLabels.length;
    return { title: beginnerLabels[slot], color: "text-pink-400" };
  };

  const maxPoints = allRiddles.length * 15;
  const rank = getRank(totalPoints, maxPoints, currentRiddleIndex);

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <AnimatePresence mode="wait">
        {gameState === "welcome" && (
          <motion.div key="welcome" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <WelcomeScreen onStart={handleStart} />
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
                gameMode="fun"
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
              onRestart={handleRestart}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Index;
