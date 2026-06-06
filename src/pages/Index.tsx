import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
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

const readLocalPuzzleIndex = () => {
  try {
    const raw = localStorage.getItem(LAST_PUZZLE_KEY);
    const parsed = Number.parseInt(raw || "", 10);
    return Number.isNaN(parsed) ? null : parsed;
  } catch {
    return null;
  }
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

  const ensureProfile = useCallback(async () => {
    if (!user) return null;

    const { data } = await supabase
      .from("profiles")
      .select("last_puzzle_index,saved_score,saved_total_points,saved_time_bonus,full_name,phone,address,completed,total_time_ms")
      .eq("user_id", user.id)
      .maybeSingle();

    return data;
  }, [user]);

  // After Google/email login: check profile, then auto-resume to last puzzle
  const autoResumedRef = useRef(false);
  useEffect(() => {
    if (!user) {
      setNeedsInfo(false);
      autoResumedRef.current = false;
      return;
    }
    (async () => {
      const data = await ensureProfile();

      // If user already completed all riddles → straight to final result, no more play
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

      // Auto-resume only once per session and only if no ?puzzle= override
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, ensureProfile]);

  // On mount: if ?puzzle=N in URL, jump directly to that puzzle
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


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

    const localIdx = readLocalPuzzleIndex();
    const profileIdx = data?.last_puzzle_index ?? 0;
    const resumeIdx = Math.max(
      0,
      Math.min(allRiddles.length - 1, Math.max(profileIdx, localIdx ?? 0))
    );

    setScore(data?.saved_score ?? 0);
    setTotalPoints(data?.saved_total_points ?? 0);
    setTimeBonus(data?.saved_time_bonus ?? 0);
    setCurrentRiddleIndex(resumeIdx);

    setShowAuth(false);
    setGameState("playing");
  }, [allRiddles.length, ensureProfile, user]);

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

  // Read ?puzzle=N from URL (1-based for users)
  const getPuzzleParam = (): number | null => {
    try {
      const params = new URLSearchParams(window.location.search);
      const raw = params.get("puzzle");
      if (!raw) return null;
      const n = parseInt(raw, 10);
      if (isNaN(n)) return null;
      const idx = Math.max(0, Math.min(allRiddles.length - 1, n - 1));
      return idx;
    } catch {
      return null;
    }
  };

  // Persist last_puzzle_index to Supabase + localStorage (debounced + dedup)
  const lastSyncedIndexRef = useRef<number | null>(null);
  const pendingIndexRef = useRef<number | null>(null);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightRef = useRef(false);

  const flushSync = useCallback(async () => {
    if (!user) return;
    if (inFlightRef.current) return;
    const target = pendingIndexRef.current;
    if (target === null || target === lastSyncedIndexRef.current) return;
    inFlightRef.current = true;
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ last_puzzle_index: target, updated_at: new Date().toISOString() })
        .eq("user_id", user.id);
      if (!error) {
        lastSyncedIndexRef.current = target;
      } else {
        console.error("Progress sync failed:", error);
      }
    } catch (e) {
      console.error("Progress sync error:", e);
    } finally {
      inFlightRef.current = false;
      // If more updates queued during request, schedule another flush
      if (pendingIndexRef.current !== lastSyncedIndexRef.current) {
        if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
        syncTimerRef.current = setTimeout(() => void flushSync(), 600);
      }
    }
  }, [user]);

  const persistLastPuzzleIndex = useCallback(
    (index: number) => {
      // 1) Local fallback — instant
      try {
        localStorage.setItem(LAST_PUZZLE_KEY, String(index));
      } catch {}
      if (!user) return;
      // 2) Debounced server sync
      pendingIndexRef.current = index;
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
      syncTimerRef.current = setTimeout(() => void flushSync(), 600);
    },
    [user, flushSync]
  );

  // Flush pending progress on tab hide / unload so we never lose a write
  useEffect(() => {
    const flush = () => {
      if (syncTimerRef.current) {
        clearTimeout(syncTimerRef.current);
        syncTimerRef.current = null;
      }
      void flushSync();
    };
    const onVis = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [flushSync]);


  const handleStart = async (_mode: GameMode) => {
    // URL param takes priority for debugging/jump
    const urlIdx = getPuzzleParam();
    if (urlIdx !== null) {
      setCurrentRiddleIndex(urlIdx);
      setShowAuth(false);
      setGameState("playing");
      return;
    }

    if (!user) {
      // Restore guest progress from localStorage if exists
      const p = loadGuestProgress();
      const localIdx = readLocalPuzzleIndex();
      const idx = Math.max(
        0,
        Math.min(allRiddles.length - 1, Math.max(localIdx ?? 0, p?.currentRiddleIndex ?? 0))
      );
      if (p) {
        setScore(p.score);
        setTotalPoints(p.totalPoints);
        setTimeBonus(p.timeBonus);
      }
      setCurrentRiddleIndex(idx);
      setShowAuth(true);
      return;
    }

    await startFromProfile();
  };

  const handleAnswer = async (
    isCorrect: boolean,
    selectedIndex: number | null,
    _remainingTime?: number,
    elapsedMs?: number | null,
  ) => {
    const newAnswered = answeredCount + 1;

    if (newAnswered >= 5) {
      showInterstitial();
      setAnsweredCount(0);
    } else {
      setAnsweredCount(newAnswered);
    }

    // Accumulate total time for ranking (default to full timer if missing)
    const addMs = typeof elapsedMs === "number" && elapsedMs > 0 ? elapsedMs : 60000;
    totalTimeMsRef.current += addMs;

    // Persist per-answer timing for the authenticated user (used to pick winners)
    if (user) {
      try {
        await supabase.from("answer_times").insert({
          user_id: user.id,
          riddle_index: currentRiddleIndex,
          elapsed_ms: addMs,
          game_mode: "fun",
        });
      } catch (e) {
        console.error("answer_times insert failed", e);
      }
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

  const markCompletedOnServer = useCallback(async () => {
    if (!user) return;
    try {
      await supabase
        .from("profiles")
        .update({
          completed: true,
          completed_at: new Date().toISOString(),
          total_time_ms: totalTimeMsRef.current,
          last_puzzle_index: allRiddles.length - 1,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);
    } catch (e) {
      console.error("mark completed failed", e);
    }
  }, [user, allRiddles.length]);

  const handleNext = () => {
    if (currentRiddleIndex < allRiddles.length - 1) {
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
      // Finished the last riddle (e.g. #400) → lock account and show final result
      setCompleted(true);
      void markCompletedOnServer();
      setGameState("result");
    }
  };

  const handleExitToHome = () => {
    // Persist current position so the user resumes here next time
    void persistLastPuzzleIndex(currentRiddleIndex);
    if (!user) {
      saveGuestProgress({
        currentRiddleIndex,
        score,
        totalPoints,
        timeBonus,
      });
    }
    setGameState("welcome");
    setShowAuth(false);
  };

  const handleRestart = () => {
    setGameState("welcome");
    setShowAuth(false);
  };


  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.error("signOut failed", e);
    }
    try {
      localStorage.removeItem(GUEST_STORAGE_KEY);
      localStorage.removeItem(LAST_PUZZLE_KEY);
    } catch {}
    window.location.href = "/";
  };

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <UserHeader />
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

        {!needsInfo && !showAuth && gameState === "welcome" && (
          <motion.div
            key="welcome"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
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
