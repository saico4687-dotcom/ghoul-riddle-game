import { motion } from "framer-motion";
import HorrorButton from "./HorrorButton";
import { Skull, Ghost, Flame, Trophy, Gamepad2 } from "lucide-react";
import heroImage from "@/assets/hero-horror.jpg";

export type GameMode = "fun" | "competition";

interface WelcomeScreenProps {
  onStart: (mode: GameMode) => void;
}

const WelcomeScreen = ({ onStart }: WelcomeScreenProps) => {
  return (
    <div className="min-h-screen bg-horror-gradient relative overflow-hidden">
      {/* Background Image */}
      <div
        className="absolute inset-0 bg-cover bg-center opacity-30"
        style={{ backgroundImage: `url(${heroImage})` }}
      />
      
      {/* Vignette */}
      <div className="vignette" />
      
      {/* Fog Overlay */}
      <div className="fog-overlay" />

      {/* Content */}
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4 text-center">
        {/* Floating Icons */}
        <motion.div
          animate={{
            y: [0, -20, 0],
            rotate: [0, 5, -5, 0],
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute top-20 left-10 text-primary/30"
        >
          <Ghost className="w-16 h-16" />
        </motion.div>
        
        <motion.div
          animate={{
            y: [0, 15, 0],
            rotate: [0, -5, 5, 0],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 1,
          }}
          className="absolute top-32 right-16 text-primary/20"
        >
          <Flame className="w-12 h-12" />
        </motion.div>

        {/* Main Content */}
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1 }}
          className="max-w-2xl"
        >
          {/* Skull Icon */}
          <motion.div
            animate={{
              scale: [1, 1.1, 1],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="mb-8"
          >
            <Skull className="w-24 h-24 mx-auto text-primary flicker" />
          </motion.div>

          {/* Title */}
          <h1 className="font-horror text-6xl md:text-8xl text-blood pulse-blood mb-6">
            ألغاز الرعب
          </h1>
          
          <p className="font-typewriter text-xl md:text-2xl text-foreground/80 mb-4">
            هل تجرؤ على دخول عالم الألغاز المرعبة؟
          </p>
          
          <p className="font-typewriter text-lg text-muted-foreground mb-8">
            400 لغز ينتظرك... إن كنت تملك الشجاعة الكافية
          </p>

          {/* Features */}
          <div className="flex flex-wrap justify-center gap-6 mb-8">
            <motion.div
              whileHover={{ scale: 1.05 }}
              className="card-horror px-6 py-4 flex items-center gap-3"
            >
              <Ghost className="w-6 h-6 text-primary" />
              <span className="font-typewriter text-foreground">أصوات مرعبة</span>
            </motion.div>
            <motion.div
              whileHover={{ scale: 1.05 }}
              className="card-horror px-6 py-4 flex items-center gap-3"
            >
              <Skull className="w-6 h-6 text-primary" />
              <span className="font-typewriter text-foreground">صور مخيفة</span>
            </motion.div>
            <motion.div
              whileHover={{ scale: 1.05 }}
              className="card-horror px-6 py-4 flex items-center gap-3"
            >
              <Flame className="w-6 h-6 text-primary" />
              <span className="font-typewriter text-foreground">تحديات ذهنية</span>
            </motion.div>
          </div>

          {/* Game Mode Buttons */}
          <div className="flex flex-col sm:flex-row justify-center gap-4 mb-8">
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <button
                onClick={() => onStart("fun")}
                className="w-full sm:w-auto flex items-center justify-center gap-3 px-8 py-4 bg-gradient-to-r from-green-700 to-green-900 hover:from-green-600 hover:to-green-800 text-white font-horror text-xl rounded-lg border-2 border-green-500 shadow-lg shadow-green-900/50 transition-all duration-300"
              >
                <Gamepad2 className="w-6 h-6" />
                <span>ألغاز المتعة (200)</span>
              </button>
            </motion.div>
            
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <button
                onClick={() => onStart("competition")}
                className="w-full sm:w-auto flex items-center justify-center gap-3 px-8 py-4 bg-gradient-to-r from-horror-blood to-red-900 hover:from-red-600 hover:to-red-800 text-white font-horror text-xl rounded-lg border-2 border-red-500 shadow-lg shadow-red-900/50 transition-all duration-300"
              >
                <Trophy className="w-6 h-6" />
                <span>ألغاز المسابقة (200)</span>
              </button>
            </motion.div>
          </div>

          {/* Score Info */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.5 }}
            className="card-horror p-4 mb-6 inline-block"
          >
            <p className="font-typewriter text-sm text-muted-foreground">
              🏆 اجمع النقاط واحصل على ترتيبك!
            </p>
            <p className="font-typewriter text-xs text-muted-foreground mt-1">
              +10 نقاط لكل إجابة صحيحة | +5 نقاط إضافية للسرعة
            </p>
          </motion.div>
        </motion.div>

        {/* Bottom Warning */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2 }}
          className="absolute bottom-8 font-typewriter text-sm text-muted-foreground"
        >
          ⚠️ تحذير: يحتوي على محتوى مرعب وأصوات مخيفة
        </motion.p>
      </div>
    </div>
  );
};

export default WelcomeScreen;