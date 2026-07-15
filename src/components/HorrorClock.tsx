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

  // رصيد الوقت المتبقي بالميلي ثانية. لا يُخصم منه إلا وقت "التكة"
  // الفعلي أثناء العد الحقيقي (isActive && !paused). أي وقت يمر أثناء
  // كتابة اللغز أو أثناء ظهور إعلان لا يُخصم منه إطلاقًا (وقف حقيقي).
  const remainingMsRef = useRef(duration * 1000);
  const lastTickRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);
  const lastExtraRef = useRef(0);
  const firedRef = useRef(false);

  // بدء مؤقت جديد عند بداية اللغز
  useEffect(() => {
    remainingMsRef.current = duration * 1000;
    lastTickRef.current = null;

    setTimeLeft(duration);

    firedRef.current = false;

    lastExtraRef.current = 0;

  }, [duration]);

  // إضافة وقت (مكافأة "أضف دقيقة") تُضاف مباشرة إلى الرصيد المتبقي
  useEffect(() => {

    if (extraTime > lastExtraRef.current) {

      const diff = extraTime - lastExtraRef.current;

      remainingMsRef.current += diff * 1000;

      lastExtraRef.current = extraTime;

      setTimeLeft(Math.max(0, Math.ceil(remainingMsRef.current / 1000)));

    }

  }, [extraTime]);

  // Timer: يعمل فقط أثناء isActive && !paused، ويخصم الوقت الفعلي
  // الذي مرّ بين كل "تكة" وأخرى من رصيد الوقت المتبقي. أي توقف
  // (كتابة اللغز أو إعلان) يعني ببساطة توقف هذا الـ effect تمامًا
  // بلا أي حساب لاحق للزمن الذي مرّ أثناء التوقف.
  useEffect(() => {

    if (!isActive || paused) {
      // عند التوقف نُصفّر "آخر تكة" حتى لا يُحتسب وقت التوقف عند الاستئناف
      lastTickRef.current = null;
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    lastTickRef.current = Date.now();

    timerRef.current = window.setInterval(() => {
      const now = Date.now();
      const last = lastTickRef.current ?? now;
      const delta = now - last;
      lastTickRef.current = now;

      remainingMsRef.current = Math.max(0, remainingMsRef.current - delta);

      const remainSec = Math.ceil(remainingMsRef.current / 1000);
      setTimeLeft(remainSec);

      if (remainingMsRef.current <= 0 && !firedRef.current) {
        firedRef.current = true;
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        onTimeUp?.();
      }
    }, 100);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isActive, paused, onTimeUp]);

  const total = duration + extraTime;
  const progress =
    total > 0 ? ((total - timeLeft) / total) * 100 : 0;

  const angle =
    total > 0 ? ((total - timeLeft) / total) * 360 : 0;

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

        <div className="absolute w-3 h-3 bg-red-600 rounded-full left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" />
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
            width: `${Math.min(100, Math.max(0, progress))}%`,
            transition: "width .1s linear",
          }}
        />
      </div>
    </motion.div>
  );
};

export default HorrorClock;
