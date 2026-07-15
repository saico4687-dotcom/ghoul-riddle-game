import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Riddle } from "@/data/riddles";

import TypewriterText from "./TypewriterText";
import RiddleOption from "./RiddleOption";
import HorrorButton from "./HorrorButton";
import HorrorClock from "./HorrorClock";

import { Brain, Mic, MicOff, Scissors, Clock } from "lucide-react";

import { useHorrorSounds } from "@/hooks/useHorrorSounds";
import { useHorrorBackgroundMusic } from "@/hooks/useHorrorBackgroundMusic";

import { showRewarded, showBannerAd, hideBannerAd } from "@/lib/ads";

import moneyBg from "@/assets/money-bg.jpg";

interface RiddleCardProps {
  riddle: Riddle;
  riddleNumber: number;
  totalRiddles: number;
  onAnswer: (
    isCorrect: boolean,
    selectedIndex: number | null,
    remainingTime?: number,
    elapsedMs?: number | null,
  ) => void;
  onNext: () => void;
  onExitToHome?: () => void;
  gameMode: "fun" | "competition";
}

const RiddleCard = ({
  riddle,
  riddleNumber,
  totalRiddles,
  onAnswer,
  onNext,
  onExitToHome,
  gameMode,
}: RiddleCardProps) => {

  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [isTypingComplete, setIsTypingComplete] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [lifelineUsed, setLifelineUsed] = useState<null | "fifty" | "time">(null);
  const [removedOptions, setRemovedOptions] = useState<number[]>([]);
  const [extraTime, setExtraTime] = useState(0);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [adPaused, setAdPaused] = useState(false);

  const { playSound, setMuted } = useHorrorSounds();
  const { setVolume: setMusicVolume } = useHorrorBackgroundMusic();

  const handleMuteToggle = () => {
    const newMutedState = !isMuted;
    setIsMuted(newMutedState);
    setMuted(newMutedState);
    setMusicVolume(newMutedState ? 0 : 0.5);
  };

  useEffect(() => {
    setSelectedOption(null);
    setShowResult(false);
    setIsTypingComplete(false);
    setLifelineUsed(null);
    setRemovedOptions([]);
    setExtraTime(0);
    setStartTime(null);

    playSound("ambient");
  }, [riddle, playSound]);

  useEffect(() => {
    if (isTypingComplete && startTime === null) {
      setStartTime(Date.now());
    }
  }, [isTypingComplete, startTime]);

  // Show banner on puzzle screen; hide when leaving
  useEffect(() => {
    void showBannerAd();
    return () => {
      void hideBannerAd();
    };
  }, []);

  const handleUseFifty = async () => {
    if (lifelineUsed || showResult) return;

    const before = Date.now();

    const earned = await showRewarded({
      onStart: () => setAdPaused(true),
      onEnd: () => setAdPaused(false),
    });

    console.log("[Rewarded] earned =", earned);

    if (startTime !== null) {
      setStartTime(startTime + (Date.now() - before));
    }

    if (!earned) {
      console.error("[Rewarded] Failed to show rewarded ad.");
      alert("لم يتم عرض إعلان المكافأة. راجع سجل الأخطاء (Logcat).");
      return;
    }

    const wrongIndices = riddle.options
      .map((_, i) => i)
      .filter((i) => i !== riddle.correctIndex);

    const toRemove = [...wrongIndices]
      .sort(() => Math.random() - 0.5)
      .slice(0, 2);

    setRemovedOptions(toRemove);
    setLifelineUsed("fifty");

    if (selectedOption !== null && toRemove.includes(selectedOption)) {
      setSelectedOption(null);
    }
  };

  const handleAddTime = async () => {
    if (lifelineUsed || showResult) return;

    const before = Date.now();

    const earned = await showRewarded({
      onStart: () => setAdPaused(true),
      onEnd: () => setAdPaused(false),
    });

    console.log("[Rewarded] earned =", earned);

    if (startTime !== null) {
      setStartTime(startTime + (Date.now() - before));
    }

    if (!earned) {
      console.error("[Rewarded] Failed to show rewarded ad.");
      alert("تعذر عرض الإعلان حاليًا، حاول مرة أخرى بعد قليل.");
      return;
    }

    setExtraTime((p) => p + 60);
    setLifelineUsed("time");
  };

  const handleTimeUp = () => {
    if (!showResult && selectedOption === null) {
      setShowResult(true);
      playSound("wrong");
      onAnswer(false, null);

      setTimeout(() => onNext(), 1800);
    }
  };

  const handleOptionClick = (index: number) => {
    if (showResult || !isTypingComplete) return;
    setSelectedOption(index);
  };

  const handleSubmit = () => {
    if (selectedOption === null) return;

    const isCorrect = selectedOption === riddle.correctIndex;
    setShowResult(true);

    playSound(isCorrect ? "correct" : "wrong");

    const elapsedMs = startTime ? Date.now() - startTime : null;
    onAnswer(isCorrect, selectedOption, undefined, elapsedMs);

    if (!isCorrect) {
      setTimeout(() => onNext(), 1800);
    }
  };

  return (
    <div
      className="w-full max-w-4xl mx-auto px-4 relative"
      style={{
        backgroundImage: `linear-gradient(rgba(0,0,0,0.78), rgba(0,0,0,0.85)), url(${moneyBg})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
        backgroundRepeat: "no-repeat",
        borderRadius: "1rem",
        padding: "1.5rem",
        paddingBottom: "calc(1.5rem + 72px)",
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center gap-4 mb-8"
      >
        <HorrorClock
          key={riddleNumber}
          duration={60}
          isActive={isTypingComplete && !showResult}
          paused={adPaused}
          onTimeUp={handleTimeUp}
          isMuted={isMuted}
          extraTime={extraTime}
        />

        {gameMode === "fun" && (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleUseFifty}
              disabled={lifelineUsed !== null || showResult || !isTypingComplete}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary border border-primary/40 text-primary text-sm font-typewriter hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              aria-label="حذف إجابتين خاطئتين"
            >
              <Scissors className="w-4 h-4" />
              <span>شاهد الإعلان لحذف إجابتين</span>
            </button>
            <button
              type="button"
              onClick={handleAddTime}
              disabled={lifelineUsed !== null || showResult || !isTypingComplete}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary border border-primary/40 text-primary text-sm font-typewriter hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              aria-label="شاهد الإعلان لإضافة دقيقة"
            >
              <Clock className="w-4 h-4" />
              <span>شاهد الإعلان لإضافة دقيقة</span>
            </button>
          </div>
        )}
        {lifelineUsed && (
          <p className="text-xs text-muted-foreground font-typewriter">
            تم استخدام أداة المساعدة لهذا السؤال
          </p>
        )}

        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-3">
            <Brain className="w-8 h-8 text-primary" />
            <span className="font-horror text-2xl text-primary">اللغز {riddleNumber} / {totalRiddles}</span>
          </div>

          <button
            type="button"
            onClick={handleMuteToggle}
            className="p-2 rounded-full bg-secondary hover:bg-accent transition-colors cursor-pointer z-50"
            aria-label={isMuted ? "تشغيل الصوت" : "كتم الصوت"}
          >
            {isMuted ? (
              <MicOff className="w-6 h-6 text-muted-foreground" />
            ) : (
              <Mic className="w-6 h-6 text-primary" />
            )}
          </button>
        </div>
      </motion.div>

      {riddle.image && (
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="image-horror mb-8"
        >
          <img
            src={riddle.image}
            alt={`صورة اللغز ${riddleNumber}`}
            className="w-full max-h-80 object-cover"
            loading="lazy"
          />
        </motion.div>
      )}

      <div className="card-horror p-6 mb-8 min-h-[120px]">
        <TypewriterText
          text={riddle.question}
          speed={40}
          className="text-xl md:text-2xl leading-relaxed text-right"
          onComplete={() => setIsTypingComplete(true)}
          onCharacterTyped={() => playSound("typewriter")}
        />
      </div>

      <AnimatePresence>
        {isTypingComplete && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4 mb-8"
          >
            {riddle.options.map((option, index) => {
              const isRemoved = removedOptions.includes(index);
              if (isRemoved) {
                return (
                  <div
                    key={index}
                    className="option-horror w-full text-right flex items-center gap-4 opacity-30 line-through pointer-events-none"
                  >
                    <span className="w-10 h-10 rounded-full bg-muted flex items-center justify-center font-horror text-muted-foreground text-xl shrink-0">
                      ✕
                    </span>
                    <span className="font-typewriter text-muted-foreground text-lg leading-relaxed">
                      {option}
                    </span>
                  </div>
                );
              }
              return (
                <RiddleOption
                  key={index}
                  option={option}
                  index={index}
                  selected={selectedOption === index}
                  showResult={showResult}
                  isCorrect={index === riddle.correctIndex}
                  onClick={() => handleOptionClick(index)}
                  disabled={showResult}
                  hideCorrectInCompetition={false}
                />
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showResult && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="card-horror p-6 mb-8 text-right"
          >
            {selectedOption === riddle.correctIndex ? (
              <>
                <h3 className="font-horror text-2xl mb-3 text-primary">🎉 أحسنت!</h3>
                <p className="font-typewriter text-foreground text-lg leading-relaxed">
                  {riddle.explanation}
                </p>
              </>
            ) : (
              <h3 className="font-horror text-2xl text-primary">🍀 حظ أوفر في المرة القادمة</h3>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex justify-center gap-4">
        {!showResult ? (
          <HorrorButton onClick={handleSubmit} disabled={selectedOption === null || !isTypingComplete}>
            تحقق من الإجابة
          </HorrorButton>
        ) : (
          <HorrorButton onClick={onNext}>
            {riddleNumber < totalRiddles ? "اللغز التالي" : "النتيجة النهائية"}
          </HorrorButton>
        )}
      </div>

      {onExitToHome && (
        <div className="flex justify-center mt-6 mb-8">
          <button
            type="button"
            onClick={onExitToHome}
            className="px-5 py-2 rounded-lg border border-primary/40 bg-secondary/60 text-primary font-typewriter text-sm hover:bg-accent transition-colors"
          >
            🏠 العودة إلى القائمة الرئيسية
          </button>
        </div>
      )}
    </div>
  );
};

export default RiddleCard;
