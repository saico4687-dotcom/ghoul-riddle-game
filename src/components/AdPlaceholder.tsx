import { motion } from "framer-motion";

interface AdPlaceholderProps {
  /** Slot identifier — useful when wiring AdSense later */
  slot: string;
  /** Friendly label shown inside the placeholder */
  label?: string;
  className?: string;
}

/**
 * Visual placeholder for an ad unit.
 * Replace the inner content with the actual AdSense / AdMob component
 * (e.g. <ins className="adsbygoogle" ... />) when integrating.
 */
const AdPlaceholder = ({ slot, label = "مساحة إعلانية", className = "" }: AdPlaceholderProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      data-ad-slot={slot}
      className={`w-full max-w-2xl mx-auto my-4 rounded-lg border-2 border-dashed border-primary/40 bg-secondary/40 backdrop-blur-sm flex items-center justify-center text-center px-4 py-6 min-h-[100px] ${className}`}
    >
      <div>
        <p className="font-typewriter text-sm text-muted-foreground">{label}</p>
        <p className="font-typewriter text-[10px] text-muted-foreground/60 mt-1">
          Ad Slot: {slot}
        </p>
      </div>
    </motion.div>
  );
};

export default AdPlaceholder;
