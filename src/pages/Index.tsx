import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import * as SplashScreen from 'expo-splash-screen';   // ← تمت الإضافة

import WelcomeScreen, { GameMode } from "@/components/WelcomeScreen";
import EmailAuthScreen from "@/components/EmailAuthScreen";
import ParticipantInfoForm from "@/components/ParticipantInfoForm";
import RiddleCard from "@/components/RiddleCard";
import ResultScreen from "@/components/ResultScreen";
import UserHeader from "@/components/UserHeader";
import { riddles } from "@/data/riddles";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { showInterstitial } from "@/lib/ads";

const LAST_PUZZLE_KEY = "rabh_last_puzzle_index_v1";

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
  const [completed, setCompleted] = useState(false);
  const totalTimeMsRef = useRef(0);

  const { user } = useAuth();

  const allRiddles = useMemo(() => riddles.slice(0, 400), []);

  // إخفاء Splash Screen فور تحميل الصفحة
  useEffect(() => {
    SplashScreen.hideAsync().catch((e) => console.warn("Splash hide error:", e));
  }, []);

  const ensureProfile = useCallback(async () => {
    if (!user) return null;

    let { data, error } = await supabase
      .from("profiles")
      .select(
        "last_puzzle_index,saved_score,saved_total_points,saved_time_bonus,full_name,phone,address,completed,total_time_ms"
      )
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      console.error("ensureProfile:", error);
      return null;
    }

    if (!data) {
      const { data: created, error: createError } = await supabase
        .from("profiles")
        .upsert(
          {
            user_id: user.id,
            email: user.email,
            full_name:
              (user.user_metadata as any)?.full_name ||
              (user.user_metadata as any)?.name ||
              "",
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" }
        )
        .select(
          "last_puzzle_index,saved_score,saved_total_points,saved_time_bonus,full_name,phone,address,completed,total_time_ms"
        )
        .single();

      if (createError) {
        console.error("Create profile:", createError);
        return null;
      }

      data = created;
    }

    return data;
  }, [user]);

  const autoResumedRef = useRef(false);
  useEffect(() => {
    if (!user) {
      setNeedsInfo(false);
      autoResumedRef.current = false;
      return;
    }

    (async () => {
      const data = await ensureProfile();
      if (!data) return;

      if (data?.completed) {
        setCompleted(true);
        setScore(data?.saved_score ?? 0);
        setTotalPoints(data?.saved_total_points ?? 0);
        setTimeBonus(data?.saved_time_bonus ?? 0);
        totalTimeMsRef.current = Number(data?.total_time_ms ?? 0);
        setNeedsInfo(false);
        setShowAuth(false);
        setGameState("result");
        autoResumedRef.current = true;
        return;
      }

      const missingInfo = !data?.full_name || !data?.phone || !data?.address;
      if (missingInfo) {
        setProfileDefaults({
          full_name: data?.full_name ?? "",
          phone: data?.phone ?? "",
          address: data?.address ?? "",
        });
        setNeedsInfo(true);
        setShowAuth(false);
        return;
      }

      if (autoResumedRef.current) return;
      const urlHasPuzzle = new URLSearchParams(window.location.search).has("puzzle");
      if (urlHasPuzzle) return;

      autoResumedRef.current = true;
      const serverIdx = data?.last_puzzle_index ?? 0;
      const localIdx = parseInt(localStorage.getItem(LAST_PUZZLE_KEY) || "", 10);
      const resumeIdx = Math.max(
        0,
        Math.min(allRiddles.length - 1, Math.max(serverIdx, isNaN(localIdx) ? 0 : localIdx))
      );

      setScore(data?.saved_score ?? 0);
      setTotalPoints(data?.saved_total_points ?? 0);
      setTimeBonus(data?.saved_time_bonus ?? 0);
      totalTimeMsRef.current = Number(data?.total_time_ms ?? 0);
      setCurrentRiddleIndex(resumeIdx);
      setShowAuth(false);
      setGameState("playing");
    })();
  }, [user, ensureProfile, allRiddles.length]);

  // باقي الـ useEffects والدوال بدون تغيير كبير...
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const raw = params.get("puzzle");
      if (!raw) return;
      const n = parseInt(raw, 10);
      if (isNaN(n)) return;
      const idx = Math.max(0, Math.min(allRiddles.length - 1, n - 1));
      setCurrentRiddleIndex(idx);
      setGameState("playing");
      setShowAuth(false);
    } catch {}
  }, [allRiddles.length]);

  // ... (باقي الكود كما هو مع الحفاظ على handleNext وكل الدوال)

  const handleNext = async () => {
    if (currentRiddleIndex < allRiddles.length - 1) {
      const solved = currentRiddleIndex + 1;

      if (solved % 5 === 0) {
        await showInterstitial();
      }

      const nextIdx = currentRiddleIndex + 1;

      setCurrentRiddleIndex(nextIdx);
      void persistLastPuzzleIndex(nextIdx);

      if (!user) {
        saveGuestProgress({
          currentRiddleIndex: nextIdx,
          score,
          totalPoints,
          timeBonus,
        });
      }
    } else {
      setCompleted(true);
      void markCompletedOnServer();
      setGameState("result");
    }
  };

  // ... (كل الدوال الأخرى تبقى كما هي)

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <UserHeader />

      {/* Debug Info (يظهر فقط في التطوير) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="fixed top-4 right-4 bg-black/80 text-white text-xs p-2 z-50 rounded">
          State: {gameState} | User: {user ? 'Yes' : 'No'} | Index: {currentRiddleIndex}
        </div>
      )}

      <AnimatePresence mode="wait">
        {/* ... باقي الـ JSX كما هو بدون تغيير */}
        {user && needsInfo && (
          <motion.div key="info" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <ParticipantInfoForm
              userId={user.id}
              defaults={profileDefaults}
              onSaved={async () => {
                setNeedsInfo(false);
                const data = await ensureProfile();
                if (!data) return;
                setScore(data.saved_score ?? 0);
                setTotalPoints(data.saved_total_points ?? 0);
                setTimeBonus(data.saved_time_bonus ?? 0);
                setCurrentRiddleIndex(data.last_puzzle_index ?? 0);
                setGameState("playing");
              }}
            />
          </motion.div>
        )}

        {!needsInfo && showAuth && (
          <motion.div key="auth" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <EmailAuthScreen onBack={() => setShowAuth(false)} />
          </motion.div>
        )}

        {!needsInfo && !showAuth && gameState === "welcome" && (
          <motion.div key="welcome" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <WelcomeScreen onStart={handleStart} />
          </motion.div>
        )}

        {gameState === "playing" && !completed && (
          <motion.div key="playing">
            <RiddleCard
              riddle={allRiddles[currentRiddleIndex]}
              riddleNumber={currentRiddleIndex + 1}
              totalRiddles={allRiddles.length}
              onAnswer={handleAnswer}
              onNext={handleNext}
              onExitToHome={handleExitToHome}
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
            completed={completed}
            onRestart={handleRestart}
            onLogout={handleLogout}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default Index;
