import { useEffect, useState, useCallback, useRef } from "react";
import { motion } from "framer-motion";

interface HorrorClockProps {
  duration: number;
  isActive: boolean;
  paused?: boolean; // إيقاف المؤقت أثناء إعلان Rewarded
  onTimeUp?: () => void;
  isMuted?: boolean;
  extraTime?: number;
}

const HorrorClock = ({
  duration,
  isActive,
  paused = false,
  onTimeUp,
  isMuted = false,
  extraTime = 0,
}: HorrorClockProps) => {
  const [timeLeft, setTimeLeft] = useState(duration);
  const [secondHandAngle, setSecondHandAngle] = useState(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const tickIntervalRef = useRef<number | null>(null);

  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return audioContextRef.current;
  }, []);

  // Horror tick sound
  const playTickSound = useCallback(() => {
    if (isMuted) return;
    
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    
    // Deep tick sound
    const tick = ctx.createOscillator();
    const tickGain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    
    tick.connect(filter);
    filter.connect(tickGain);
    tickGain.connect(ctx.destination);
    
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(800, now);
    
    tick.type = "square";
    tick.frequency.setValueAtTime(80, now);
    tick.frequency.exponentialRampToValueAtTime(40, now + 0.1);
    
    tickGain.gain.setValueAtTime(0.15, now);
    tickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    
    tick.start(now);
    tick.stop(now + 0.15);
    
    // Creepy resonance
    const resonance = ctx.createOscillator();
    const resGain = ctx.createGain();
    const resFilter = ctx.createBiquadFilter();
    
    resonance.connect(resFilter);
    resFilter.connect(resGain);
    resGain.connect(ctx.destination);
    
    resFilter.type = "bandpass";
    resFilter.frequency.setValueAtTime(150, now);
    resFilter.Q.setValueAtTime(10, now);
    
    resonance.type = "sine";
    resonance.frequency.setValueAtTime(100, now);
    
    resGain.gain.setValueAtTime(0.05, now);
    resGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    
    resonance.start(now);
    resonance.stop(now + 0.2);

    // Add eerie whisper-like undertone every few seconds
    if (timeLeft <= 10 && timeLeft > 0) {
      const whisper = ctx.createOscillator();
      const whisperGain = ctx.createGain();
      const whisperFilter = ctx.createBiquadFilter();
      
      whisper.connect(whisperFilter);
      whisperFilter.connect(whisperGain);
      whisperGain.connect(ctx.destination);
      
      whisperFilter.type = "bandpass";
      whisperFilter.frequency.setValueAtTime(600 + Math.random() * 200, now);
      whisperFilter.Q.setValueAtTime(5, now);
      
      whisper.type = "sawtooth";
      whisper.frequency.setValueAtTime(200, now);
      whisper.frequency.linearRampToValueAtTime(150, now + 0.3);
      
      whisperGain.gain.setValueAtTime(0.03, now);
      whisperGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      
      whisper.start(now);
      whisper.stop(now + 0.3);
    }
  }, [isMuted, getAudioContext, timeLeft]);

  useEffect(() => {
    setTimeLeft(duration);
    setSecondHandAngle(0);
  }, [duration]);

  // Apply extra time when lifeline used
  const lastExtraRef = useRef(0);
  useEffect(() => {
    if (extraTime > lastExtraRef.current) {
      const delta = extraTime - lastExtraRef.current;
      lastExtraRef.current = extraTime;
      setTimeLeft((prev) => prev + delta);
    }
    if (extraTime === 0) lastExtraRef.current = 0;
  }, [extraTime]);

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
      
      setSecondHandAngle((prev) => prev + 6); // 360 / 60 = 6 degrees per second
      playTickSound();
    }, 1000);

    // Play initial tick
    playTickSound();

    return () => {
      if (tickIntervalRef.current) {
        clearInterval(tickIntervalRef.current);
      }
    };
  }, [isActive, onTimeUp, playTickSound]);

  const progress = ((duration - timeLeft) / duration) * 100;
  const isUrgent = timeLeft <= 10;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center gap-2"
    >
      {/* Clock Face */}
      <div 
        className={`relative w-24 h-24 rounded-full border-4 ${
          isUrgent ? 'border-blood animate-pulse' : 'border-primary'
        } bg-secondary/50 backdrop-blur-sm shadow-[0_0_20px_rgba(139,0,0,0.5)]`}
      >
        {/* Hour marks */}
        {[...Array(12)].map((_, i) => (
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
        
        {/* Center dot */}
        <div className={`absolute top-1/2 left-1/2 w-3 h-3 rounded-full ${
          isUrgent ? 'bg-blood' : 'bg-primary'
        } -translate-x-1/2 -translate-y-1/2 z-20`} />
        
        {/* Minute hand (static for visual) */}
        <div
          className="absolute w-1 h-8 bg-muted-foreground rounded-full"
          style={{
            bottom: '50%',
            left: '50%',
            transform: 'translateX(-50%)',
            transformOrigin: 'bottom center',
          }}
        />
        
        {/* Second hand */}
        <motion.div
          className={`absolute w-0.5 h-10 ${isUrgent ? 'bg-blood' : 'bg-primary'} rounded-full`}
          style={{
            bottom: '50%',
            left: '50%',
            transformOrigin: 'bottom center',
          }}
          animate={{ 
            rotate: secondHandAngle,
            scale: isUrgent ? [1, 1.02, 1] : 1
          }}
          transition={{ 
            rotate: { duration: 0.1, ease: "easeOut" },
            scale: { duration: 0.5, repeat: Infinity }
          }}
        />

        {/* Glowing effect when urgent */}
        {isUrgent && (
          <div className="absolute inset-0 rounded-full animate-pulse bg-blood/20" />
        )}
      </div>

      {/* Time display */}
      <motion.div 
        className={`font-horror text-2xl ${isUrgent ? 'text-blood animate-pulse' : 'text-primary'}`}
        animate={isUrgent ? { scale: [1, 1.1, 1] } : {}}
        transition={{ duration: 0.5, repeat: Infinity }}
      >
        {Math.floor(timeLeft / 60).toString().padStart(2, '0')}:
        {(timeLeft % 60).toString().padStart(2, '0')}
      </motion.div>

      {/* Progress bar */}
      <div className="w-24 h-1.5 bg-secondary rounded-full overflow-hidden">
        <motion.div
          className={`h-full ${isUrgent ? 'bg-blood' : 'bg-primary'}`}
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>
    </motion.div>
  );
};

export default HorrorClock;
