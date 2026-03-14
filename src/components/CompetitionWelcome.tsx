import { useEffect } from "react";
import { motion } from "framer-motion";
import maskedPersonImage from "@/assets/masked-person.jpg";

interface CompetitionWelcomeProps {
  onComplete: () => void;
}

const CompetitionWelcome = ({ onComplete }: CompetitionWelcomeProps) => {
  useEffect(() => {
    const timer = setTimeout(onComplete, 5000);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="fixed inset-0 bg-background overflow-hidden" dir="rtl">
      {/* Background masked person */}
      <motion.div
        className="absolute inset-0"
        animate={{ scale: [1, 1.05, 1] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      >
        <img
          src={maskedPersonImage}
          alt="شخص مقنع"
          className="w-full h-full object-cover"
        />
      </motion.div>

      {/* Dark overlay */}
      <motion.div
        className="absolute inset-0 bg-black/50"
        animate={{ opacity: [0.5, 0.7, 0.5] }}
        transition={{ duration: 3, repeat: Infinity }}
      />

      {/* "تعالى" gesture text */}
      <motion.div
        className="absolute top-1/3 left-0 right-0 text-center z-10"
        animate={{ y: [0, -10, 0], opacity: [0.7, 1, 0.7] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        <span className="font-horror text-5xl text-primary drop-shadow-lg text-glow">
          تعالى 👋
        </span>
      </motion.div>

      {/* Welcome message */}
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 1 }}
        className="absolute bottom-1/3 left-0 right-0 text-center z-10 px-4"
      >
        <h1 className="font-horror text-4xl text-primary-foreground drop-shadow-lg mb-4 text-glow">
          مرحباً بك في المسابقة
        </h1>
        <motion.p
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="font-typewriter text-muted-foreground text-sm"
        >
          جاري الانتقال للألغاز...
        </motion.p>
      </motion.div>

      <div className="fog-overlay" />
    </div>
  );
};

export default CompetitionWelcome;
