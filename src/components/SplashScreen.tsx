import { motion } from "framer-motion";

const SplashScreen = () => {
  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.8 }}
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background overflow-hidden"
      dir="rtl"
    >
      {/* Pulsing blood vignette */}
      <motion.div
        className="absolute inset-0 bg-gradient-radial from-transparent via-transparent to-horror-blood/40 pointer-events-none"
        animate={{ opacity: [0.4, 0.8, 0.4] }}
        transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Flickering glow */}
      <motion.div
        className="absolute inset-0 bg-horror-glow/5"
        animate={{ opacity: [0, 0.3, 0, 0.2, 0] }}
        transition={{ duration: 3, repeat: Infinity }}
      />

      {/* Title */}
      <motion.h1
        initial={{ scale: 0.7, opacity: 0, filter: "blur(20px)" }}
        animate={{ scale: 1, opacity: 1, filter: "blur(0px)" }}
        transition={{ duration: 1.4, ease: "easeOut" }}
        className="font-horror text-5xl md:text-7xl text-blood relative z-10 text-center px-6"
        style={{ textShadow: "0 0 30px hsl(var(--horror-blood) / 0.8)" }}
      >
        ألغاز الرعب
      </motion.h1>

      {/* Subtitle */}
      <motion.p
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.8, duration: 1 }}
        className="font-typewriter text-base md:text-lg text-muted-foreground mt-6 relative z-10"
      >
        ادخل إن كنت تجرؤ...
      </motion.p>

      {/* Loading dots */}
      <div className="flex gap-2 mt-10 relative z-10">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="w-3 h-3 rounded-full bg-primary"
            animate={{ opacity: [0.2, 1, 0.2], scale: [0.8, 1.2, 0.8] }}
            transition={{
              duration: 1.2,
              repeat: Infinity,
              delay: i * 0.2,
            }}
          />
        ))}
      </div>
    </motion.div>
  );
};

export default SplashScreen;
