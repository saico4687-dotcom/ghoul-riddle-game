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


import HeartRateMonitor from "./HeartRateMonitor";

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
  const [clockKey, setClockKey] = useState(0);
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
    setClockKey((prev) => prev + 1);
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

    // Freeze timer for the exact duration of the rewarded ad
    const before = Date.now();
    await showRewarded({
      onStart: () => setAdPaused(true),
      onEnd: () => setAdPaused(false),
    });
    // Compensate elapsed startTime so no seconds are lost
    if (startTime !== null) {
      setStartTime(startTime + (Date.now() - before));
    }


    const wrongIndices = riddle.options
      .map((_, i) => i)
      .filter((i) => i !== riddle.correctIndex);

    const toRemove = wrongIndices
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

    const earned = await showRewarded();
    if (!earned) return;

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
        borderRadius: "1rem",
        padding: "1.5rem",
      }}
    >
      <motion.div className="flex flex-col items-center gap-4 mb-8">
        <HorrorClock
          key={clockKey}
          duration={60}
          isActive={isTypingComplete && !showResult}
          onTimeUp={handleTimeUp}
          isMuted={isMuted}
          extraTime={extraTime}
        />

        {gameMode === "fun" && (
          <div className="flex gap-3">
            <button onClick={handleUseFifty}>شاهد إعلان لحذف إجابتين</button>
            <button onClick={handleAddTime}>شاهد إعلان لإضافة وقت</button>
          </div>
        )}

        <div className="flex justify-between w-full">
          <div className="flex gap-2 items-center">
            <Brain className="w-8 h-8 text-primary" />
            <span>اللغز {riddleNumber} / {totalRiddles}</span>
          </div>

          <button onClick={handleMuteToggle}>
            {isMuted ? <MicOff /> : <Mic />}
          </button>
        </div>
      </motion.div>

      <div className="card-horror p-6 mb-8">
        <TypewriterText
          text={riddle.question}
          speed={40}
          onComplete={() => setIsTypingComplete(true)}
        />
      </div>

      {isTypingComplete && (
        <div className="space-y-4">
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
            />
          ))}
        </div>
      )}

      <div className="flex justify-center mt-6">
        {!showResult ? (
          <HorrorButton onClick={handleSubmit} disabled={selectedOption === null}>
            تحقق من الإجابة
          </HorrorButton>
        ) : (
          <HorrorButton onClick={onNext}>
            اللغز التالي
          </HorrorButton>
        )}
      </div>
    </div>
  );
};

export default RiddleCard;
