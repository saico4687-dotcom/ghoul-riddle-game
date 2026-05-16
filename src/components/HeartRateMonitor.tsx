import { motion } from "framer-motion";
import { Heart } from "lucide-react";

interface HeartRateMonitorProps {
  status: "alive" | "flatline";
  bpm?: number;
}

// Single ECG waveform cycle (PQRST), 200 wide
const ECG_SEGMENT =
  "M0,50 L20,50 L28,48 L36,52 L44,50 L60,50 L66,20 L72,80 L78,30 L84,50 L110,50 L118,55 L126,45 L134,50 L200,50";
const FLATLINE = "M0,50 L200,50";

const HeartRateMonitor = ({ status, bpm = 78 }: HeartRateMonitorProps) => {
  const isFlat = status === "flatline";

  return (
    <div className="relative w-full aspect-video rounded-xl overflow-hidden border-2 border-primary/40 bg-[#02110a] shadow-[0_0_30px_rgba(0,255,120,0.15)_inset]">
      {/* Grid background */}
      <svg className="absolute inset-0 w-full h-full opacity-30" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="ecgGrid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke={isFlat ? "#7a1f1f" : "#0f5132"} strokeWidth="0.5" />
          </pattern>
          <pattern id="ecgGridBig" width="100" height="100" patternUnits="userSpaceOnUse">
            <path d="M 100 0 L 0 0 0 100" fill="none" stroke={isFlat ? "#9b2c2c" : "#10b981"} strokeWidth="0.8" opacity="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#ecgGrid)" />
        <rect width="100%" height="100%" fill="url(#ecgGridBig)" />
      </svg>

      {/* Top status bar */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 py-2 z-10 font-mono text-xs md:text-sm">
        <div className={`flex items-center gap-2 ${isFlat ? "text-red-400" : "text-emerald-300"}`}>
          <span className={`w-2 h-2 rounded-full ${isFlat ? "bg-red-500" : "bg-emerald-400 animate-pulse"}`} />
          <span>{isFlat ? "ASYSTOLE" : "SINUS RHYTHM"}</span>
        </div>
        <div className={`flex items-center gap-2 ${isFlat ? "text-red-400" : "text-emerald-300"}`}>
          <motion.div
            animate={isFlat ? { scale: 1 } : { scale: [1, 1.25, 1] }}
            transition={isFlat ? {} : { duration: 60 / bpm, repeat: Infinity, ease: "easeInOut" }}
          >
            <Heart className={`w-4 h-4 ${isFlat ? "fill-red-500/40" : "fill-emerald-400"}`} />
          </motion.div>
          <span className="tabular-nums">{isFlat ? "-- BPM" : `${bpm} BPM`}</span>
        </div>
      </div>

      {/* ECG trace */}
      <svg viewBox="0 0 800 200" preserveAspectRatio="none" className="absolute inset-0 w-full h-full">
        <g transform="translate(0, 50)">
          <motion.g
            animate={{ x: [0, -1000] }}
            transition={{ duration: (60 / bpm) * 5, repeat: Infinity, ease: "linear" }}
          >
            {Array.from({ length: 12 }).map((_, i) => (
              <motion.path
                key={i}
                initial={false}
                animate={{ d: isFlat && i >= 3 ? FLATLINE : ECG_SEGMENT }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                transform={`translate(${i * 200}, 0)`}
                fill="none"
                stroke={isFlat && i >= 3 ? "#ef4444" : "#34d399"}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ filter: `drop-shadow(0 0 4px ${isFlat && i >= 3 ? "#ef4444" : "#34d399"})` }}
              />
            ))}
          </motion.g>
        </g>
      </svg>

      {/* Scanline */}
      {!isFlat && (
        <motion.div
          className="absolute top-0 bottom-0 w-px bg-emerald-300/70 shadow-[0_0_8px_rgba(52,211,153,0.9)]"
          animate={{ left: ["0%", "100%"] }}
          transition={{ duration: 60 / bpm, repeat: Infinity, ease: "linear" }}
        />
      )}
    </div>
  );
};

export default HeartRateMonitor;
