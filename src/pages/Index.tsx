import { useState, useMemo, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import WelcomeScreen, { GameMode } from "@/components/WelcomeScreen";
import CompetitionIntro from "@/components/CompetitionIntro";
import CompetitionDashboard from "@/components/CompetitionDashboard";
import PaymentConfirmation from "@/components/PaymentConfirmation";
import CompetitionWelcome from "@/components/CompetitionWelcome";
import RiddleCard from "@/components/RiddleCard";
import ResultScreen from "@/components/ResultScreen";
import BackButton from "@/components/BackButton";
import { riddles } from "@/data/riddles";
import { AnimatePresence, motion } from "framer-motion";
import WelcomeScreen, { GameMode } from "@/components/WelcomeScreen";
import CompetitionIntro from "@/components/CompetitionIntro";
import CompetitionDashboard from "@/components/CompetitionDashboard";
import PaymentConfirmation from "@/components/PaymentConfirmation";
import CompetitionWelcome from "@/components/CompetitionWelcome";
import RiddleCard from "@/components/RiddleCard";
import ResultScreen from "@/components/ResultScreen";
import { riddles } from "@/data/riddles";
import { useHorrorBackgroundMusic } from "@/hooks/useHorrorBackgroundMusic";
import { supabase } from "@/integrations/supabase/client";
import { updateCompetitionScore } from "@/hooks/useCompetitionScore";

type GameState =
  | "welcome"
  | "competition-intro"
  | "competition-dashboard"
  | "payment-confirmation"
  | "competition-welcome"
  | "playing"
  | "result";

const Index = () => {
  const [gameState, setGameState] = useState<GameState>("welcome");
  const [currentRiddleIndex, setCurrentRiddleIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [totalPoints, setTotalPoints] = useState(0);
  const [gameMode, setGameMode] = useState<GameMode>("fun");
  const [timeBonus, setTimeBonus] = useState(0);
  const { startMusic, stopMusic, isPlaying: isMusicPlaying } = useHorrorBackgroundMusic();

  const funRiddles = useMemo(() => riddles.slice(0, 200), []);
  const competitionRiddles = useMemo(() => riddles.slice(200, 400), []);

  const currentRiddles = useMemo(
    () => (gameMode === "fun" ? funRiddles : competitionRiddles),
    [gameMode, funRiddles, competitionRiddles]
  );

  // Check for existing session on mount (for OAuth redirect return)
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session && gameState === "welcome") {
        setGameMode("competition");
        setGameState("competition-dashboard");
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") {
        setGameMode("competition");
        setGameState("competition-dashboard");
      }
    });

    checkSession();
    return () => subscription.unsubscribe();
  }, []);

  const handleStart = (mode: GameMode) => {
    if (mode === "competition") {
      setGameState("competition-intro");
      return;
    }
    setGameMode(mode);
    setGameState("playing");
    setCurrentRiddleIndex(0);
    setScore(0);
    setTotalPoints(0);
    setTimeBonus(0);
    startMusic();
  };

  const handleCompetitionAuthenticated = () => {
    setGameMode("competition");
    setGameState("competition-dashboard");
  };

  const handleStartCompetitionPuzzles = () => {
    setCurrentRiddleIndex(0);
    setScore(0);
    setTotalPoints(0);
    setTimeBonus(0);
    setGameState("playing");
  };

  const handleEnterDraw = () => {
    setGameState("payment-confirmation");
  };

  const handlePaymentConfirm = () => {
    // Open Vodafone Cash payment
    window.open("tel:*9*01062612970*50%23", "_self");
    // Show welcome screen after confirmation
    setGameState("competition-welcome");
  };

  const handleWelcomeComplete = () => {
    handleStartCompetitionPuzzles();
  };

  // Stop music when leaving fun riddles
  useEffect(() => {
    if (gameState !== "playing" || gameMode !== "fun") {
      if (isMusicPlaying) {
        stopMusic();
      }
    }
  }, [gameState, gameMode, isMusicPlaying, stopMusic]);

  const handleAnswer = (isCorrect: boolean, remainingTime?: number) => {
    if (isCorrect) {
      setScore((prev) => prev + 1);
      let points = 10;
      if (remainingTime !== undefined && remainingTime > 0) {
        const bonus = Math.min(5, Math.floor(remainingTime / 12));
        points += bonus;
        setTimeBonus((prev) => prev + bonus);
      }
      setTotalPoints((prev) => prev + points);

      // Sync to DB for competition mode
      if (gameMode === "competition") {
        const bonusVal = remainingTime !== undefined ? Math.min(5, Math.floor(remainingTime / 12)) : 0;
        updateCompetitionScore(points, 1, 1, bonusVal);
      }
    } else if (gameMode === "competition") {
      updateCompetitionScore(0, 0, 1, 0);
    }
  };

  const handleNext = () => {
    if (currentRiddleIndex < currentRiddles.length - 1) {
      setCurrentRiddleIndex((prev) => prev + 1);
    } else {
      setGameState("result");
    }
  };

  const handleRestart = () => {
    if (gameMode === "competition") {
      setGameState("competition-dashboard");
    } else {
      setGameState("welcome");
    }
    setCurrentRiddleIndex(0);
    setScore(0);
    setTotalPoints(0);
    setTimeBonus(0);
  };

  const getRank = (points: number, totalPossible: number) => {
    const percentage = (points / totalPossible) * 100;
    if (percentage >= 90) return { title: "أسطورة الرعب 👑", color: "text-yellow-400" };
    if (percentage >= 75) return { title: "سيد الألغاز 🏆", color: "text-purple-400" };
    if (percentage >= 60) return { title: "محقق ماهر 🔍", color: "text-blue-400" };
    if (percentage >= 45) return { title: "مغامر شجاع ⚔️", color: "text-green-400" };
    if (percentage >= 30) return { title: "مبتدئ واعد 📚", color: "text-orange-400" };
    return { title: "مرعوب 😱", color: "text-red-400" };
  };

  const maxPoints = currentRiddles.length * 15;
  const rank = getRank(totalPoints, maxPoints);

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <AnimatePresence mode="wait">
        {gameState === "welcome" && (
          <motion.div key="welcome" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <WelcomeScreen onStart={handleStart} />
          </motion.div>
        )}

        {gameState === "competition-intro" && (
          <motion.div key="competition-intro" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <BackButton onClick={() => setGameState("welcome")} />
            <CompetitionIntro onAuthenticated={handleCompetitionAuthenticated} />
          </motion.div>
        )}

        {gameState === "competition-dashboard" && (
          <motion.div key="competition-dashboard" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <BackButton onClick={() => setGameState("welcome")} />
            <CompetitionDashboard
              onStartPuzzles={handleStartCompetitionPuzzles}
              onEnterDraw={handleEnterDraw}
            />
          </motion.div>
        )}

        {gameState === "payment-confirmation" && (
          <motion.div key="payment-confirmation" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <BackButton onClick={() => setGameState("competition-dashboard")} />
            <PaymentConfirmation onConfirm={handlePaymentConfirm} />
          </motion.div>
        )}

        {gameState === "competition-welcome" && (
          <motion.div key="competition-welcome" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <BackButton onClick={() => setGameState("competition-dashboard")} />
            <CompetitionWelcome onComplete={handleWelcomeComplete} />
          </motion.div>
        )}

        {gameState === "playing" && (
          <motion.div key="playing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="min-h-screen bg-horror-gradient py-8">
            <div className="vignette" />
            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="fixed top-4 left-4 z-50 card-horror px-4 py-2">
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
            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="fixed top-4 right-4 z-50">
              <div className={`px-4 py-2 rounded-lg font-horror text-sm ${
                gameMode === "fun"
                  ? "bg-green-900/80 text-green-300 border border-green-500"
                  : "bg-red-900/80 text-red-300 border border-red-500"
              }`}>
                {gameMode === "fun" ? "🎮 ألغاز المتعة" : "🏆 ألغاز المسابقة"}
              </div>
            </motion.div>
            <div className="pt-16">
              <RiddleCard
                riddle={currentRiddles[currentRiddleIndex]}
                riddleNumber={currentRiddleIndex + 1}
                totalRiddles={currentRiddles.length}
                onAnswer={handleAnswer}
                onNext={handleNext}
                gameMode={gameMode}
              />
            </div>
          </motion.div>
        )}

        {gameState === "result" && (
          <motion.div key="result" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <ResultScreen
              score={score}
              totalQuestions={currentRiddles.length}
              totalPoints={totalPoints}
              maxPoints={maxPoints}
              timeBonus={timeBonus}
              rank={rank}
              gameMode={gameMode}
              onRestart={handleRestart}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Index;
