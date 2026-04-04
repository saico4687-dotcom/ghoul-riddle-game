import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Riddle } from "@/data/riddles";
import TypewriterText from "./TypewriterText";
import RiddleOption from "./RiddleOption";
import HorrorButton from "./HorrorButton";
import HorrorClock from "./HorrorClock";
import { Skull, Mic, MicOff } from "lucide-react";
import { useHorrorSounds } from "@/hooks/useHorrorSounds";

interface RiddleCardProps {
  riddle: Riddle;
  riddleNumber: number;
  totalRiddles: number;
  onAnswer: (isCorrect: boolean) => void;
  onNext: () => void;
  gameMode: "fun" | "competition";
  onMuteToggle?: (muted: boolean) => void;
}

const RiddleCard = ({
  riddle,
  riddleNumber,
  totalRiddles,
  onAnswer,
  onNext,
  gameMode,
  onMuteToggle,
}: RiddleCardProps) => {
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [isTypingComplete, setIsTypingComplete] = useState(false);
  const [clockKey, setClockKey] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const { playSound, setMuted } = useHorrorSounds();
  
  // Throttle typewriter sound - play only every 3rd character
  const charCountRef = useRef(0);
  const handleCharacterTyped = useCallback(() => {
    charCountRef.current++;
    if (charCountRef.current % 3 === 0) {
      playSound("typewriter");
    }
  }, [playSound]);

  const handleMuteToggle = () => {
    const newMutedState = !isMuted;
    setIsMuted(newMutedState);
    setMuted(newMutedState);
    onMuteToggle?.(newMutedState);
  };

  useEffect(() => {
    setSelectedOption(null);
    setShowResult(false);
    setIsTypingComplete(false);
    setClockKey((prev) => prev + 1);
    charCountRef.current = 0;
  }, [riddle]);

  const handleTimeUp = () => {
    if (!showResult && selectedOption === null) {
      setShowResult(true);
      playSound("wrong");
      onAnswer(false);
      
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
    
    if (gameMode === "competition" && !isCorrect) {
      setTimeout(() => {
        onNext();
      }, 1500);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4">
      {/* Header with Clock */}
      <div className="flex flex-col items-center gap-4 mb-8">
        <HorrorClock
          key={clockKey}
          duration={60}
          isActive={isTypingComplete && !showResult}
          onTimeUp={handleTimeUp}
          isMuted={isMuted}
        />
        
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-3">
            <Skull className="w-8 h-8 text-primary" />
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
      </div>

      {/* Image - simplified, no vortex spin */}
      <div className={`mb-8 relative aspect-video rounded-lg overflow-hidden ${gameMode === "fun" ? "" : "image-horror"}`}>
        <img
          src={riddle.image}
          alt="صورة اللغز"
          className="w-full h-full object-cover"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
      </div>

      {/* Question */}
      <div className="card-horror p-6 mb-8 min-h-[120px]">
        <TypewriterText
          text={riddle.question}
          speed={40}
          className="text-xl md:text-2xl leading-relaxed text-right"
          onComplete={() => setIsTypingComplete(true)}
          onCharacterTyped={handleCharacterTyped}
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
            {riddle.options.map((option, index) => (
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
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Result */}
      <AnimatePresence>
        {showResult && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="card-horror p-6 mb-8 text-right"
          >
            <h3 className="font-horror text-2xl mb-3 text-primary">
              {selectedOption === riddle.correctIndex ? "🎃 أحسنت!" : "💀 خطأ!"}
            </h3>
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
