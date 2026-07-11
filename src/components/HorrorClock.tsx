import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

interface HorrorClockProps {
  duration: number;
  isActive: boolean;
  paused?: boolean;
  extraTime?: number;
  onTimeUp?: () => void;
  isMuted?: boolean;
}

const HorrorClock = ({
  duration,
  isActive,
  paused = false,
  extraTime = 0,
  onTimeUp,
}: HorrorClockProps) => {

  const [timeLeft, setTimeLeft] = useState(duration);

  const endTimeRef = useRef(0);
  const pauseStartedRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);
  const lastExtraRef = useRef(0);
  const firedRef = useRef(false);

  // بدء مؤقت جديد عند بداية اللغز
  useEffect(() => {
    endTimeRef.current = Date.now() + duration * 1000;

    setTimeLeft(duration);

    firedRef.current = false;

    lastExtraRef.current = 0;

  }, [duration]);

  // إضافة وقت
  useEffect(() => {

    if (extraTime > lastExtraRef.current) {

      const diff = extraTime - lastExtraRef.current;

      endTimeRef.current += diff * 1000;

      lastExtraRef.current = extraTime;

    }

  }, [extraTime]);

  // Pause
  useEffect(() => {

    if (!isActive) return;

    if (paused) {

      pauseStartedRef.current = Date.now();

    } else {

      if (pauseStartedRef.current !== null) {

        const pausedFor = Date.now() - pauseStartedRef.current;

        endTimeRef.current += pausedFor;

        pauseStartedRef.current = null;

      }

    }

  }, [paused, isActive]);

  // Timer
  useEffect(() => {

    if (!isActive || paused) {

      if (timerRef.current) {

        clearInterval(timerRef.current);

        timerRef.current = null;

      }

      return;

    }

    timerRef.current = window.setInterval(() => {

      const remain = Math.max(
        0,
        Math.ceil((endTimeRef.current - Date.now()) / 1000)
      );

      setTimeLeft(remain);

      if (remain <= 0 && !firedRef.current) {

        firedRef.current = true;

        if (timerRef.current) {

          clearInterval(timerRef.current);

        }

        onTimeUp?.();

      }

    }, 100);

    return () => {

      if (timerRef.current) {

        clearInterval(timerRef.current);

      }

    };

  }, [isActive, paused, onTimeUp]);

  const total = duration + extraTime;

  const progress =
    ((total - timeLeft) / total) * 100;

  const angle =
    ((total - timeLeft) / total) * 360;

  const urgent = timeLeft <= 10;

  return (

    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col items-center gap-2"
    >

      <div
        className={`relative w-24 h-24 rounded-full border-4 ${
          urgent ? "border-red-600" : "border-primary"
        }`}
      >

        {[...Array(12)].map((_, i) => (

          <div
            key={i}
            className="absolute w-1 h-3 bg-gray-400"
            style={{
              top: 6,
              left: "50%",
              transform: `translateX(-50%) rotate(${i * 30}deg)`,
              transformOrigin: "center 42px",
            }}
          />

        ))}

        <div
          className="absolute w-1 h-10 bg-red-500 rounded-full"
          style={{
            left: "50%",
            bottom: "50%",
            transformOrigin: "bottom center",
            transform: `translateX(-50%) rotate(${angle}deg)`,
          }}
        />

        <div className="absolute w-3 h-3 bg-red-600 rounded-full left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"/>

      </div>

      <div
        className={`text-2xl font-bold ${
          urgent ? "text-red-600" : "text-primary"
        }`}
      >
        {String(Math.floor(timeLeft / 60)).padStart(2, "0")}:
        {String(timeLeft % 60).padStart(2, "0")}
      </div>

      <div className="w-24 h-2 bg-gray-700 rounded-full overflow-hidden">

        <div
          className={`h-full ${
            urgent ? "bg-red-600" : "bg-primary"
          }`}
          style={{
            width: `${progress}%`,
            transition: "width .1s linear",
          }}
        />

      </div>

    </motion.div>

  );
};

export default HorrorClock;
