import { useEffect, useState, useCallback, useRef } from "react";
import { motion } from "framer-motion";

interface HorrorClockProps {
  duration: number;
  isActive: boolean;
  onTimeUp?: () => void;
  isMuted?: boolean;
}

const HOUR_MARKS = Array.from({ length: 12 }, (_, i) => i);

const HorrorClock = ({ duration, isActive, onTimeUp, isMuted = false }: HorrorClockProps) => {
  const [timeLeft, setTimeLeft] = useState(duration);
  const [secondHandAngle, setSecondHandAngle] = useState(0);
  const tickIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    setTimeLeft(duration);
    setSecondHandAngle(0);
  }, [duration]);

  useEffect(() => {
    if (!isActive) {
      if (tickIntervalRef.current) {
        clearInterval(tickIntervalRef.current);
        tickIntervalRef.current = null;
      }
      return;
    }

    tickIntervalRef.current = window.setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          if (tickIntervalRef.current) {
            clearInterval(tickIntervalRef.current);
          }
          onTimeUp?.();
          return 0;
        }
        return prev - 1;
      });
      setSecondHandAngle((prev) => prev + 6);
    }, 1000);

    return () => {
      if (tickIntervalRef.current) {
        clearInterval(tickIntervalRef.current);
      }
    };
  }, [isActive, onTimeUp]);

  const progress = ((duration - timeLeft) / duration) * 100;
  const isUrgent = timeLeft <= 10;

  return (
    <div className="flex flex-col items-center gap-2">
      {/* Clock Face */}
      <div 
        className={`relative w-24 h-24 rounded-full border-4 ${
          isUrgent ? 'border-destructive' : 'border-primary'
        } bg-secondary/50 shadow-[0_0_20px_rgba(139,0,0,0.5)]`}
      >
        {HOUR_MARKS.map((i) => (
          <div
            key={i}
            className="absolute w-1 h-3 bg-muted-foreground"
            style={{
              top: '8px',
              left: '50%',
              transform: `translateX(-50%) rotate(${i * 30}deg)`,
              transformOrigin: 'center 40px',
            }}
          />
        ))}
        
        <div className={`absolute top-1/2 left-1/2 w-3 h-3 rounded-full ${
          isUrgent ? 'bg-destructive' : 'bg-primary'
        } -translate-x-1/2 -translate-y-1/2 z-20`} />
        
        <div
          className="absolute w-1 h-8 bg-muted-foreground rounded-full"
          style={{
            bottom: '50%',
            left: '50%',
            transform: 'translateX(-50%)',
            transformOrigin: 'bottom center',
          }}
        />
        
        <div
          className={`absolute w-0.5 h-10 ${isUrgent ? 'bg-destructive' : 'bg-primary'} rounded-full`}
          style={{
            bottom: '50%',
            left: '50%',
            transform: `translateX(-50%) rotate(${secondHandAngle}deg)`,
            transformOrigin: 'bottom center',
            transition: 'transform 0.1s ease-out',
          }}
        />
      </div>

      {/* Time display */}
      <div className={`font-horror text-2xl ${isUrgent ? 'text-destructive' : 'text-primary'}`}>
        {Math.floor(timeLeft / 60).toString().padStart(2, '0')}:
        {(timeLeft % 60).toString().padStart(2, '0')}
      </div>

      {/* Progress bar */}
      <div className="w-24 h-1.5 bg-secondary rounded-full overflow-hidden">
        <div
          className={`h-full transition-[width] duration-300 ${isUrgent ? 'bg-destructive' : 'bg-primary'}`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
};

export default HorrorClock;
