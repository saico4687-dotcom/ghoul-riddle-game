import { motion } from "framer-motion";
import { Heart } from "lucide-react";
import { useEffect, useState } from "react";

interface HeartRateMonitorProps {
  status: "alive" | "flatline";
  bpm?: number;
}

// PQRST cycle, 200 wide
const ECG_SEGMENT =
  "M0,50 L20,50 L28,48 L36,52 L44,50 L60,50 L66,20 L72,80 L78,30 L84,50 L110,50 L118,55 L126,45 L134,50 L200,50";
// Glitch / flatline burst pattern
const GLITCH_SEGMENT =
  "M0,50 L40,50 L50,50 L60,50 L80,50 L100,50 L120,50 L140,50 L160,50 L180,50 L200,50";

const HeartRateMonitor = ({ status, bpm = 78 }: HeartRateMonitorProps) => {
  const isWrong = status === "flatline";
  const [glitch, setGlitch] = useState(false);
  const [shake, setShake] = useState(false);

  // Trigger short glitch/shake burst whenever wrong answer occurs
  useEffect(() => {
    if (!isWrong) return;
    setGlitch(true);
    setShake(true);
    const t1 = setTimeout(() => setGlitch(false), 700);
    const t2 = setTimeout(() => setShake(false), 900);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [isWrong]);

  const traceColor = glitch ? "#ef4444" : "#34d399";
  const cycle = 60 / bpm;

  return (
    <motion.div
      animate={shake ? { x: [0, -6, 6, -4, 4, -2, 2, 0] } : { x: 0 }}
      transition={{ duration: 0.5 }}
      className={`relative w-full aspect-video rounded-xl overflow-hidden border-2 bg-[#02110a] ${
        glitch
          ? "border-red-500/70 shadow-[0_0_40px_rgba(239,68,68,0.35)_inset]"
          : "border-primary/40 shadow-[0_0_30px_rgba(0,255,120,0.18)_inset]"
      }`}
    >
      {/* Animated ambient glow */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        animate={{
          background: glitch
            ? [
                "radial-gradient(circle at 30% 50%, rgba(239,68,68,0.25), transparent 60%)",
                "radial-gradient(circle at 70% 50%, rgba(239,68,68,0.25), transparent 60%)",
              ]
            : [
                "radial-gradient(circle at 20% 50%, rgba(52,211,153,0.18), transparent 60%)",
                "radial-gradient(circle at 80% 50%, rgba(52,211,153,0.18), transparent 60%)",
                "radial-gradient(circle at 20% 50%, rgba(52,211,153,0.18), transparent 60%)",
              ],
        }}
        transition={{ duration: glitch ? 0.4 : 4, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Animated grid background (slow drift) */}
      <motion.svg
        className="absolute inset-0 w-full h-full opacity-30"
        xmlns="http://www.w3.org/2000/svg"
        animate={{ backgroundPositionX: ["0px", "-40px"] }}
      >
        <defs>
          <pattern id="ecgGrid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke={glitch ? "#7a1f1f" : "#0f5132"} strokeWidth="0.5" />
          </pattern>
          <pattern id="ecgGridBig" width="100" height="100" patternUnits="userSpaceOnUse">
            <path d="M 100 0 L 0 0 0 100" fill="none" stroke={glitch ? "#9b2c2c" : "#10b981"} strokeWidth="0.8" opacity="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#ecgGrid)" />
        <rect width="100%" height="100%" fill="url(#ecgGridBig)" />
      </motion.svg>

      {/* Drifting grid overlay using CSS */}
      <motion.div
        className="absolute inset-0 opacity-20 pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(${glitch ? "#7a1f1f" : "#10b981"} 1px, transparent 1px), linear-gradient(90deg, ${glitch ? "#7a1f1f" : "#10b981"} 1px, transparent 1px)`,
          backgroundSize: "40px 40px",
        }}
        animate={{ backgroundPositionX: ["0px", "-40px"] }}
        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
      />

      {/* Top status bar */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 py-2 z-10 font-mono text-xs md:text-sm">
        <div className={`flex items-center gap-2 ${glitch ? "text-red-400" : "text-emerald-300"}`}>
          <motion.span
            className={`w-2 h-2 rounded-full ${glitch ? "bg-red-500" : "bg-emerald-400"}`}
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: cycle, repeat: Infinity }}
          />
          <span>{glitch ? "ARRHYTHMIA" : "SINUS RHYTHM"}</span>
        </div>
        <div className={`flex items-center gap-2 ${glitch ? "text-red-400" : "text-emerald-300"}`}>
          <motion.div
            animate={{ scale: [1, 1.25, 1] }}
            transition={{ duration: cycle, repeat: Infinity, ease: "easeInOut" }}
          >
            <Heart className={`w-4 h-4 ${glitch ? "fill-red-500" : "fill-emerald-400"}`} />
          </motion.div>
          <span className="tabular-nums">{bpm} BPM</span>
        </div>
      </div>

      {/* ECG trace (never stops) */}
      <svg viewBox="0 0 800 200" preserveAspectRatio="none" className="absolute inset-0 w-full h-full">
        <g transform="translate(0, 50)">
          <motion.g
            animate={{ x: [0, -1200] }}
            transition={{ duration: cycle * 6, repeat: Infinity, ease: "linear" }}
          >
            {Array.from({ length: 14 }).map((_, i) => {
              // During glitch, randomly flatten 1-2 segments for a "skip beat" feeling
              const isGlitched = glitch && (i % 4 === 1 || i % 5 === 2);
              return (
                <motion.path
                  key={i}
                  initial={false}
                  animate={{ d: isGlitched ? GLITCH_SEGMENT : ECG_SEGMENT }}
                  transition={{ duration: 0.15, ease: "easeOut" }}
                  transform={`translate(${i * 200}, 0)`}
                  fill="none"
                  stroke={traceColor}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ filter: `drop-shadow(0 0 6px ${traceColor})` }}
                />
              );
            })}
          </motion.g>
        </g>
      </svg>

      {/* Scanline always running */}
      <motion.div
        className={`absolute top-0 bottom-0 w-px ${
          glitch ? "bg-red-300/80 shadow-[0_0_10px_rgba(239,68,68,0.9)]" : "bg-emerald-300/70 shadow-[0_0_8px_rgba(52,211,153,0.9)]"
        }`}
        animate={{ left: ["0%", "100%"] }}
        transition={{ duration: cycle, repeat: Infinity, ease: "linear" }}
      />

      {/* Red flash overlay on wrong */}
      <motion.div
        className="absolute inset-0 bg-red-500 pointer-events-none"
        initial={{ opacity: 0 }}
        animate={glitch ? { opacity: [0, 0.35, 0, 0.2, 0] } : { opacity: 0 }}
        transition={{ duration: 0.7 }}
      />
    </motion.div>
  );
};

export default HeartRateMonitor;
