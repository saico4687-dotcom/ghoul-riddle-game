import { useState, useMemo, useEffect, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import WelcomeScreen, { GameMode } from "@/components/WelcomeScreen";
import RiddleCard from "@/components/RiddleCard";
import ResultScreen from "@/components/ResultScreen";
import GoogleLoginScreen from "@/components/GoogleLoginScreen";
import { riddles } from "@/data/riddles";
import { useHorrorBackgroundMusic } from "@/hooks/useHorrorBackgroundMusic";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

type GameState = "welcome" | "login" | "playing" | "result" | "admin";

const Index = () => {
  const [gameState, setGameState] = useState<GameState>("welcome");
  const [currentRiddleIndex, setCurrentRiddleIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [totalPoints, setTotalPoints] = useState(0);
  const [gameMode, setGameMode] = useState<GameMode>("fun");
  const [timeBonus, setTimeBonus] = useState(0);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const { startMusic, stopMusic, isPlaying: isMusicPlaying } = useHorrorBackgroundMusic();
  const { user, loading, role } = useAuth();

  const funRiddles = useMemo(() => riddles.slice(0, 200), []);
  const competitionRiddles = useMemo(() => riddles.slice(200, 400), []);

  const currentRiddles = useMemo(() => 
    gameMode === "fun" ? funRiddles : competitionRiddles,
    [gameMode, funRiddles, competitionRiddles]
  );

  // Ensure profile exists, create if missing
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
        name: user.user_metadata?.full_name || user.user_metadata?.name || '',
        profile_image: user.user_metadata?.avatar_url || user.user_metadata?.picture || '',
      })
      .select("last_puzzle_index, saved_score, saved_total_points, saved_time_bonus")
      .single();
    
    return newProfile;
  }, [user]);

  // Save progress after each riddle in competition mode
  const saveProgress = useCallback(async (newIndex: number, newScore: number, newTotalPoints: number, newTimeBonus: number) => {
    if (!user || gameMode !== "competition") return;
    await supabase
      .from("profiles")
      .update({ 
        last_puzzle_index: newIndex, 
        saved_score: newScore,
        saved_total_points: newTotalPoints,
        saved_time_bonus: newTimeBonus,
        updated_at: new Date().toISOString() 
      })
      .eq("user_id", user.id);
  }, [user, gameMode]);

  // When user logs in while on login screen, load progress then start
  useEffect(() => {
    if (gameState === "login" && user) {
      (async () => {
        const data = await ensureProfile();
        const startIndex = data?.last_puzzle_index ?? 0;
        
        setGameMode("competition");
        setCurrentRiddleIndex(startIndex);
        setScore(data?.saved_score ?? 0);
        setTotalPoints(data?.saved_total_points ?? 0);
        setTimeBonus(data?.saved_time_bonus ?? 0);
        setProfileLoaded(true);
        setGameState("playing");
      })();
    }
  }, [user, gameState, ensureProfile]);

  const handleStart = async (mode: GameMode) => {
    if (mode === "competition" && !user) {
      setGameMode("competition");
      setGameState("login");
      return;
    }

    if (mode === "competition" && user) {
      // Admin bypasses all restrictions
      if (role === "admin") {
        const data = await ensureProfile();
        setCurrentRiddleIndex(0);
        setScore(0);
        setTotalPoints(0);
        setTimeBonus(0);
        setGameMode(mode);
        setGameState("playing");
        return;
      }

      // Regular user: check payment status
      const { data: scoreData } = await supabase
        .from("competition_scores")
        .select("payment_status")
        .eq("user_id", user.id)
        .single();

      if (scoreData?.payment_status === "تم الدفع") {
        // Competition locked - user already paid
        return;
      }

      const data = await ensureProfile();
      const startIndex = data?.last_puzzle_index ?? 0;

      if (startIndex >= competitionRiddles.length) {
        setCurrentRiddleIndex(0);
        setScore(data?.saved_score ?? 0);
        setTotalPoints(data?.saved_total_points ?? 0);
        setTimeBonus(data?.saved_time_bonus ?? 0);
        setGameMode(mode);
        setGameState("result");
        return;
      } else {
        setCurrentRiddleIndex(startIndex);
        setScore(data?.saved_score ?? 0);
        setTotalPoints(data?.saved_total_points ?? 0);
        setTimeBonus(data?.saved_time_bonus ?? 0);
      }
    } else {
      setCurrentRiddleIndex(0);
      setScore(0);
      setTotalPoints(0);
      setTimeBonus(0);
    }

    setGameMode(mode);
    setGameState("playing");
    
    if (mode === "fun") {
      startMusic();
    }
  };

  useEffect(() => {
    if (gameState !== "playing" || gameMode !== "fun") {
      if (isMusicPlaying) {
        stopMusic();
      }
    }
  }, [gameState, gameMode, isMusicPlaying, stopMusic]);

  const handleAnswer = (isCorrect: boolean, remainingTime?: number) => {
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

    // Save after every answer in competition mode (not for admin)
    if (gameMode === "competition" && user && role !== "admin") {
      const nextIndex = currentRiddleIndex + 1;
      saveProgress(nextIndex, newScore, newTotalPoints, newTimeBonus);
    }
  };

  const handleNext = () => {
    if (currentRiddleIndex < currentRiddles.length - 1) {
      const newIndex = currentRiddleIndex + 1;
      setCurrentRiddleIndex(newIndex);
    } else {
      setGameState("result");
    }
  };

  const handleRestart = async () => {
    if (gameMode === "competition" && user && role !== "admin") {
      await supabase
        .from("profiles")
        .update({ 
          last_puzzle_index: 0, 
          saved_score: 0, 
          saved_total_points: 0, 
          saved_time_bonus: 0,
          updated_at: new Date().toISOString() 
        })
        .eq("user_id", user.id);
    }
    setGameState("welcome");
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
          <motion.div
            key="welcome"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <WelcomeScreen onStart={handleStart} isAdmin={role === "admin"} onAdminDashboard={() => setGameState("admin")} />
          </motion.div>
        )}

        {gameState === "login" && (
          <motion.div
            key="login"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <GoogleLoginScreen onBack={() => setGameState("welcome")} />
          </motion.div>
        )}

        {gameState === "admin" && (
          <motion.div
            key="admin"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* Lazy-load admin dashboard */}
            <AdminDashboardWrapper onBack={() => setGameState("welcome")} />
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

            {/* Game Mode Badge + User Info */}
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="fixed top-4 right-4 z-50 flex items-center gap-3"
            >
              {gameMode === "competition" && user && (
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

// Wrapper to lazy import AdminDashboard
import AdminDashboard from "@/pages/AdminDashboard";
const AdminDashboardWrapper = ({ onBack }: { onBack: () => void }) => {
  return <AdminDashboard onBack={onBack} />;
};

export default Index;
