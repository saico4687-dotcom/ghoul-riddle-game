import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Riddle } from "@/data/riddles";
import TypewriterText from "./TypewriterText";
import RiddleOption from "./RiddleOption";
import HorrorButton from "./HorrorButton";
import HorrorClock from "./HorrorClock";
import { Skull, Mic, MicOff, Scissors, Clock } from "lucide-react";
import { useHorrorSounds } from "@/hooks/useHorrorSounds";
import { useHorrorBackgroundMusic } from "@/hooks/useHorrorBackgroundMusic";
import moneyBg from "@/assets/money-bg.jpg";

interface RiddleCardProps {
  riddle: Riddle;
  riddleNumber: number;
  totalRiddles: number;
  onAnswer: (isCorrect: boolean) => void;
  onNext: () => void;
  gameMode: "fun" | "competition";
}

const RiddleCard = ({
  riddle,
  riddleNumber,
  totalRiddles,
  onAnswer,
  onNext,
  gameMode,
}: RiddleCardProps) => {
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [isTypingComplete, setIsTypingComplete] = useState(false);
  const [clockKey, setClockKey] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [lifelineUsed, setLifelineUsed] = useState<null | "fifty" | "time">(null);
  const [removedOptions, setRemovedOptions] = useState<number[]>([]);
  const [extraTime, setExtraTime] = useState(0);
  const { playSound, setMuted } = useHorrorSounds();
  const { setVolume: setMusicVolume } = useHorrorBackgroundMusic();

  // Sync mute state with sound effects and background music
  const handleMuteToggle = () => {
    const newMutedState = !isMuted;
    setIsMuted(newMutedState);
    setMuted(newMutedState);
    
    // Toggle background music mute
    if (newMutedState) {
      setMusicVolume(0);
    } else {
      setMusicVolume(0.5);
    }
  };

  useEffect(() => {
    setSelectedOption(null);
    setShowResult(false);
    setIsTypingComplete(false);
    setClockKey((prev) => prev + 1); // Reset clock for new riddle
    setLifelineUsed(null);
    setRemovedOptions([]);
    setExtraTime(0);
    // Play ambient sound when new riddle loads
    playSound("ambient");
  }, [riddle, playSound]);

  const handleUseFifty = () => {
    if (lifelineUsed || showResult) return;
    // Pick one wrong option to remove
    const wrongIndices = riddle.options
      .map((_, i) => i)
      .filter((i) => i !== riddle.correctIndex);
    const randomWrong = wrongIndices[Math.floor(Math.random() * wrongIndices.length)];
    setRemovedOptions([randomWrong]);
    setLifelineUsed("fifty");
    if (selectedOption === randomWrong) setSelectedOption(null);
  };

  const handleAddTime = () => {
    if (lifelineUsed || showResult) return;
    setExtraTime((prev) => prev + 60);
    setLifelineUsed("time");
  };

  const handleTimeUp = () => {
    if (!showResult && selectedOption === null) {
      // Auto-submit as wrong when time is up
      setShowResult(true);
      playSound("wrong");
      onAnswer(false);
      
      // In competition mode, auto-advance after time up
      if (gameMode === "competition") {
        setTimeout(() => {
          onNext();
        }, 1500);
      }
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
    onAnswer(isCorrect);
    
    // In competition mode, auto-advance after wrong answer
    if (gameMode === "competition" && !isCorrect) {
      setTimeout(() => {
        onNext();
      }, 1500); // Short delay to show "خطأ!" message
    }
  };

  return (
    <div
      className="w-full max-w-4xl mx-auto px-4 relative"
      style={
        gameMode === "competition"
          ? {
              backgroundImage: `linear-gradient(rgba(0,0,0,0.78), rgba(0,0,0,0.85)), url(${moneyBg})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              backgroundAttachment: "fixed",
              backgroundRepeat: "no-repeat",
              borderRadius: "1rem",
              padding: "1.5rem",
            }
          : undefined
      }
    >
      {/* Header with Clock */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center gap-4 mb-8"
      >
        {/* Clock Timer */}
        <HorrorClock
          key={clockKey}
          duration={60}
          isActive={isTypingComplete && !showResult}
          onTimeUp={handleTimeUp}
          isMuted={isMuted}
          extraTime={extraTime}
        />

        {/* Lifelines (Competition mode only) */}
        {gameMode === "competition" && (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleUseFifty}
              disabled={lifelineUsed !== null || showResult || !isTypingComplete}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary border border-primary/40 text-primary text-sm font-typewriter hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              aria-label="حذف إجابة خاطئة"
            >
              <Scissors className="w-4 h-4" />
              <span>حذف إجابة خاطئة</span>
            </button>
            <button
              type="button"
              onClick={handleAddTime}
              disabled={lifelineUsed !== null || showResult || !isTypingComplete}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary border border-primary/40 text-primary text-sm font-typewriter hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              aria-label="إضافة دقيقة"
            >
              <Clock className="w-4 h-4" />
              <span>+1 دقيقة</span>
            </button>
          </div>
        )}
        {gameMode === "competition" && lifelineUsed && (
          <p className="text-xs text-muted-foreground font-typewriter">
            تم استخدام أداة المساعدة لهذا السؤال
          </p>
        )}
        
        {/* Riddle Counter and Mute */}
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-3">
            <Skull className="w-8 h-8 text-primary flicker" />
            <span className="font-horror text-2xl text-blood">
              اللغز {riddleNumber} / {totalRiddles}
            </span>
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

      {/* Image */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className={`mb-8 relative aspect-video ${gameMode === "fun" ? "vortex-container" : "image-horror"}`}
      >
        <img
          src={riddle.image}
          alt="صورة اللغز"
          className={`w-full h-full object-cover ${gameMode === "fun" ? "vortex-image" : ""}`}
        />
        {gameMode === "fun" && (
          <>
            <div className="vortex-overlay" />
            <div className="vortex-glow" />
          </>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
      </motion.div>

      {/* Question */}
      <div className="card-horror p-6 mb-8 min-h-[120px]">
        <TypewriterText
          text={riddle.question}
          speed={40}
          className="text-xl md:text-2xl leading-relaxed text-right"
          onComplete={() => setIsTypingComplete(true)}
          onCharacterTyped={() => playSound("typewriter")}
        />
      </div>

      {/* Options */}
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
                  hideCorrectInCompetition={gameMode === "competition" && selectedOption !== riddle.correctIndex}
                />
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Result */}
      <AnimatePresence>
        {showResult && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="card-horror p-6 mb-8 text-right"
          >
            <h3 className="font-horror text-2xl mb-3 text-primary">
              {selectedOption === riddle.correctIndex ? "🎃 أحسنت!" : "💀 خطأ!"}
            </h3>
            {/* In competition mode, hide explanation for wrong answers */}
            {(gameMode === "fun" || selectedOption === riddle.correctIndex) && (
              <p className="font-typewriter text-foreground text-lg leading-relaxed">
                {riddle.explanation}
              </p>
            )}
            {gameMode === "competition" && selectedOption !== riddle.correctIndex && (
              <p className="font-typewriter text-muted-foreground text-lg">
                الإجابة خاطئة... جرب حظك في اللغز التالي!
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Actions */}
      <div className="flex justify-center gap-4">
        {!showResult ? (
          <HorrorButton
            onClick={handleSubmit}
            disabled={selectedOption === null || !isTypingComplete}
          >
            تحقق من الإجابة
          </HorrorButton>
        ) : (
          <HorrorButton onClick={onNext}>
            {riddleNumber < totalRiddles ? "اللغز التالي" : "النتيجة النهائية"}
          </HorrorButton>
        )}
      </div>
    </div>
  );
};

export default RiddleCard;
