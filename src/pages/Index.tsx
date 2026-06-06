import { useState, useMemo, useCallback, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import WelcomeScreen, { GameMode } from "@/components/WelcomeScreen";
import EmailAuthScreen from "@/components/EmailAuthScreen";
import ParticipantInfoForm from "@/components/ParticipantInfoForm";
import RiddleCard from "@/components/RiddleCard";
import ResultScreen from "@/components/ResultScreen";
import { riddles } from "@/data/riddles";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { showInterstitial } from "@/lib/ads";

type GameState = "welcome" | "playing" | "result";

const GUEST_STORAGE_KEY = "rabh_guest_progress_v1";

type GuestProgress = {
  currentRiddleIndex: number;
  score: number;
  totalPoints: number;
  timeBonus: number;
};

const loadGuestProgress = (): GuestProgress | null => {
  try {
    const raw = localStorage.getItem(GUEST_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const saveGuestProgress = (p: GuestProgress) => {
  try {
    localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(p));
  } catch {}
};

const Index = () => {
  const [gameState, setGameState] = useState<GameState>("welcome");
  const [showAuth, setShowAuth] = useState(false);
  const [needsInfo, setNeedsInfo] = useState(false);
  const [profileDefaults, setProfileDefaults] = useState<{
    full_name?: string | null;
    phone?: string | null;
    address?: string | null;
  }>({});

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
      .select("last_puzzle_index,saved_score,saved_total_points,saved_time_bonus,full_name,phone,address")
      .eq("user_id", user.id)
      .maybeSingle();

    return data;
  }, [user]);

  // After Google/email login, check if user needs to fill profile info
  useEffect(() => {
    if (!user) {
      setNeedsInfo(false);
      return;
    }
    (async () => {
      const data = await ensureProfile();
      if (!data?.full_name || !data?.phone || !data?.address) {
        setProfileDefaults({
          full_name: data?.full_name ?? "",
          phone: data?.phone ?? "",
          address: data?.address ?? "",
        });
        setNeedsInfo(true);
        setShowAuth(false);
      }
    })();
  }, [user, ensureProfile]);

  const startFreshGame = () => {
    setCurrentRiddleIndex(0);
    setScore(0);
    setTotalPoints(0);
    setTimeBonus(0);
    setAnsweredCount(0);
    setGameState("playing");
  };

  const startFromProfile = useCallback(async () => {
    if (!user) return;

    const data = await ensureProfile();

    setScore(data?.saved_score ?? 0);
    setTotalPoints(data?.saved_total_points ?? 0);
    setTimeBonus(data?.saved_time_bonus ?? 0);
    setCurrentRiddleIndex(data?.last_puzzle_index ?? 0);

    setShowAuth(false);
    setGameState("playing");
  }, [ensureProfile, user]);

  const startAsGuest = () => {
    const p = loadGuestProgress();

    if (p) {
      setScore(p.score);
      setTotalPoints(p.totalPoints);
      setTimeBonus(p.timeBonus);
      setCurrentRiddleIndex(p.currentRiddleIndex);
    }

    setShowAuth(false);
    setGameState("playing");
  };

  const handleStart = async (_mode: GameMode) => {
    if (!user) {
      setShowAuth(true);
      return;
    }

    await startFromProfile();
  };

  const handleAnswer = async (
    isCorrect: boolean,
    selectedIndex: number | null
  ) => {
    const newAnswered = answeredCount + 1;

    if (newAnswered >= 5) {
      showInterstitial();
      setAnsweredCount(0);
    } else {
      setAnsweredCount(newAnswered);
    }

    if (!user) {
      const newScore = isCorrect ? score + 1 : score;
      const newPoints = isCorrect ? totalPoints + 10 : totalPoints;

      if (isCorrect) {
        setScore(newScore);
        setTotalPoints(newPoints);
      }

      saveGuestProgress({
        currentRiddleIndex,
        score: newScore,
        totalPoints: newPoints,
        timeBonus,
      });
    }
  };

  const handleNext = () => {
    if (currentRiddleIndex < allRiddles.length - 1) {
      setCurrentRiddleIndex(currentRiddleIndex + 1);
    } else {
      setGameState("result");
    }
  };

  const handleRestart = () => {
    setGameState("welcome");
    setShowAuth(false);
  };

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <AnimatePresence mode="wait">

        {user && needsInfo && (
          <motion.div
            key="info"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <ParticipantInfoForm
              userId={user.id}
              defaults={profileDefaults}
              onSaved={() => setNeedsInfo(false)}
            />
          </motion.div>
        )}

        {!needsInfo && showAuth && (
          <motion.div
            key="auth"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <EmailAuthScreen
              onBack={() => setShowAuth(false)}
            />
          </motion.div>
        )}

        {!showAuth && gameState === "welcome" && (
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
          <motion.div key="playing">
            <RiddleCard
              riddle={allRiddles[currentRiddleIndex]}
              riddleNumber={currentRiddleIndex + 1}
              totalRiddles={allRiddles.length}
              onAnswer={handleAnswer}
              onNext={handleNext}
              gameMode="fun"
            />
          </motion.div>
        )}

        {gameState === "result" && (
          <ResultScreen
            score={score}
            totalQuestions={allRiddles.length}
            totalPoints={totalPoints}
            maxPoints={allRiddles.length * 15}
            timeBonus={timeBonus}
            rank={{ title: "محقق ماهر 🔍", color: "text-blue-400" }}
            onRestart={handleRestart}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default Index;
