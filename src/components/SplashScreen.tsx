import { motion } from "framer-motion";

const SplashScreen = () => {
  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.8 }}
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-horror-gradient overflow-hidden"
      dir="rtl"
    >
      <motion.div
        className="absolute inset-0 bg-gradient-radial from-transparent via-transparent to-primary/20 pointer-events-none"
        animate={{ opacity: [0.4, 0.8, 0.4] }}
        transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
      />

      <motion.h1
        initial={{ scale: 0.7, opacity: 0, filter: "blur(20px)" }}
        animate={{ scale: 1, opacity: 1, filter: "blur(0px)" }}
        transition={{ duration: 1.4, ease: "easeOut" }}
        className="font-horror text-7xl md:text-9xl text-primary relative z-10 text-center px-6"
        style={{ textShadow: "0 0 40px hsl(var(--primary) / 0.8)" }}
      >
        ربح
      </motion.h1>

      <motion.p
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.8, duration: 1 }}
        className="font-typewriter text-base md:text-lg text-foreground/90 mt-6 relative z-10"
      >
        استعد لتحدّي عقلك...
      </motion.p>

      <div className="flex gap-2 mt-10 relative z-10">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="w-3 h-3 rounded-full bg-primary"
            animate={{ opacity: [0.2, 1, 0.2], scale: [0.8, 1.2, 0.8] }}
            transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
          />
        ))}
      </div>
    </motion.div>
  );
};

export default SplashScreen;
