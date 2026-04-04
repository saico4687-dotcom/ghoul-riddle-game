import { useState, useMemo, useEffect, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import WelcomeScreen, { GameMode } from "@/components/WelcomeScreen";
import RiddleCard from "@/components/RiddleCard";
import ResultScreen from "@/components/ResultScreen";
import GoogleSignIn from "@/components/GoogleSignIn";
import UserProfileBar from "@/components/UserProfileBar";
import { riddles } from "@/data/riddles";
import { useHorrorBackgroundMusic } from "@/hooks/useHorrorBackgroundMusic";
import { useAuth } from "@/hooks/useAuth";

type GameState = "welcome" | "playing" | "result";

const Index = () => {
  const [gameState, setGameState] = useState<GameState>("welcome");
  const [currentRiddleIndex, setCurrentRiddleIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [totalPoints, setTotalPoints] = useState(0);
  const [gameMode, setGameMode] = useState<GameMode>("fun");
  const [timeBonus, setTimeBonus] = useState(0);
  const [pendingCompetition, setPendingCompetition] = useState(false);
  const { startMusic, stopMusic, isPlaying: isMusicPlaying, setVolume: setMusicVolume } = useHorrorBackgroundMusic();
  const { user, profile, loading, signInWithGoogle, signOut, updateLastPuzzleIndex } = useAuth();

  const funRiddles = useMemo(() => riddles.slice(0, 200), []);
  const competitionRiddles = useMemo(() => riddles.slice(200, 400), []);

  const currentRiddles = useMemo(() => 
    gameMode === "fun" ? funRiddles : competitionRiddles,
    [gameMode, funRiddles, competitionRiddles]
  );

  useEffect(() => {
    if (pendingCompetition && user && profile) {
      setPendingCompetition(false);
      startCompetition();
    }
  }, [user, profile, pendingCompetition]);

  const startCompetition = () => {
    const startIndex = profile?.last_puzzle_index || 0;
    setGameMode("competition");
    setGameState("playing");
    setCurrentRiddleIndex(startIndex);
    setScore(0);
    setTotalPoints(0);
    setTimeBonus(0);
  };

  const handleStart = (mode: GameMode) => {
    if (mode === "competition") {
      if (user && profile) {
        startCompetition();
      } else {
        setPendingCompetition(true);
      }
      return;
    }

    setGameMode("fun");
    setGameState("playing");
    setCurrentRiddleIndex(0);
    setScore(0);
    setTotalPoints(0);
    setTimeBonus(0);
    startMusic();
  };

  useEffect(() => {
    if (gameState !== "playing" || gameMode !== "fun") {
      if (isMusicPlaying) {
        stopMusic();
      }
    }
  }, [gameState, gameMode, isMusicPlaying, stopMusic]);

  const handleAnswer = useCallback((isCorrect: boolean, remainingTime?: number) => {
    if (isCorrect) {
      setScore((prev) => prev + 1);
      let points = 10;
      if (remainingTime !== undefined && remainingTime > 0) {
        const bonus = Math.min(5, Math.floor(remainingTime / 12));
        points += bonus;
        setTimeBonus((prev) => prev + bonus);
      }
      setTotalPoints((prev) => prev + points);
    }
  }, []);

  const handleNext = useCallback(() => {
    if (currentRiddleIndex < currentRiddles.length - 1) {
      const nextIndex = currentRiddleIndex + 1;
      setCurrentRiddleIndex(nextIndex);
      if (gameMode === "competition" && user) {
        updateLastPuzzleIndex(nextIndex);
      }
    } else {
      setGameState("result");
      if (gameMode === "competition" && user) {
        updateLastPuzzleIndex(currentRiddles.length);
      }
    }
  }, [currentRiddleIndex, currentRiddles.length, gameMode, user, updateLastPuzzleIndex]);

  const handleRestart = () => {
    setGameState("welcome");
    setCurrentRiddleIndex(0);
    setScore(0);
    setTotalPoints(0);
    setTimeBonus(0);
    setPendingCompetition(false);
  };

  const handleMuteToggle = useCallback((muted: boolean) => {
    setMusicVolume(muted ? 0 : 0.5);
  }, [setMusicVolume]);

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

  if (pendingCompetition && !user && !loading) {
    return (
      <div dir="rtl">
        <GoogleSignIn onSignIn={signInWithGoogle} loading={loading} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <AnimatePresence mode="wait">
        {gameState === "welcome" && (
          <motion.div
            key="welcome"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
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
            
            {/* Score Display */}
            <div className="fixed top-4 left-4 z-50 card-horror px-4 py-2">
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
            </div>

            {gameMode === "competition" && profile && (
              <UserProfileBar
                name={profile.name}
                email={profile.email}
                profileImage={profile.profile_image}
                onSignOut={signOut}
              />
            )}

            {gameMode === "fun" && (
              <div className="fixed top-4 right-4 z-50">
                <div className="px-4 py-2 rounded-lg font-horror text-sm bg-green-900/80 text-green-300 border border-green-500">
                  🎮 ألغاز المتعة
                </div>
              </div>
            )}
            
            <div className="pt-16">
              <RiddleCard
                riddle={currentRiddles[currentRiddleIndex]}
                riddleNumber={currentRiddleIndex + 1}
                totalRiddles={currentRiddles.length}
                onAnswer={handleAnswer}
                onNext={handleNext}
                gameMode={gameMode}
                onMuteToggle={handleMuteToggle}
              />
            </div>
          </motion.div>
        )}

        {gameState === "result" && (
          <motion.div
            key="result"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
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
