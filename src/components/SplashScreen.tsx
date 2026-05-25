import { motion } from "framer-motion";
import { useEffect } from "react";
import appIcon from "@/assets/app-icon.png";

const SplashScreen = () => {
  // Remove the boot splash injected in index.html as soon as the React splash mounts
  useEffect(() => {
    const boot = document.getElementById("boot-splash");
    if (boot) boot.remove();
  }, []);

  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6 }}
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden"
      style={{
        background:
          "linear-gradient(160deg, #3b1466 0%, #5b1f8a 45%, #2a0d4a 100%)",
      }}
      dir="rtl"
    >
      {/* Soft animated glow */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(circle at 50% 45%, rgba(255,200,60,0.18), transparent 55%)",
        }}
        animate={{ opacity: [0.5, 0.9, 0.5] }}
        transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
      />

      <motion.img
        src={appIcon}
        alt="Come Bound"
        width={180}
        height={180}
        initial={{ scale: 0.7, opacity: 0, filter: "blur(16px)" }}
        animate={{ scale: 1, opacity: 1, filter: "blur(0px)" }}
        transition={{ duration: 0.9, ease: [0.2, 0.8, 0.2, 1] }}
        className="w-40 h-40 sm:w-48 sm:h-48 md:w-56 md:h-56 relative z-10 rounded-3xl shadow-2xl"
        style={{
          boxShadow:
            "0 10px 40px rgba(0,0,0,0.45), 0 0 60px rgba(255, 200, 60, 0.25)",
        }}
      />

      <motion.h1
        initial={{ y: 16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.25, duration: 0.8, ease: "easeOut" }}
        className="relative z-10 text-center px-6 mt-8 font-extrabold"
        style={{
          color: "#ffc83d",
          fontSize: "clamp(40px, 9vw, 64px)",
          textShadow: "0 0 30px rgba(255, 200, 60, 0.55)",
          letterSpacing: "0.5px",
        }}
      >
        Come Bound
      </motion.h1>

      <motion.p
        initial={{ y: 16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.45, duration: 0.8 }}
        className="font-typewriter mt-4 relative z-10 text-white/90"
        style={{ fontSize: "clamp(14px, 4vw, 18px)" }}
      >
        استعد لتحدّي عقلك...
      </motion.p>

      <div className="flex gap-2 mt-10 relative z-10">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="w-2.5 h-2.5 rounded-full"
            style={{ background: "#ffc83d" }}
            animate={{ opacity: [0.25, 1, 0.25], scale: [0.8, 1.2, 0.8] }}
            transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
          />
        ))}
      </div>
    </motion.div>
  );
};

export default SplashScreen;
