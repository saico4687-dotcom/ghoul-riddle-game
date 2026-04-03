import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import maskedPersonImage from "@/assets/masked-person.jpg";
import { lovable } from "@/integrations/lovable/index";
import { supabase } from "@/integrations/supabase/client";

interface CompetitionIntroProps {
  onAuthenticated: () => void;
}

const CompetitionIntro = ({ onAuthenticated }: CompetitionIntroProps) => {
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        setError("حدث خطأ أثناء تسجيل الدخول. حاول مرة أخرى.");
        setLoading(false);
        return;
      }
      // If redirected, the page will reload and we check session in parent
      if (!result.redirected) {
        onAuthenticated();
      }
    } catch {
      setError("حدث خطأ غير متوقع. حاول مرة أخرى.");
      setLoading(false);
    }
  };

  const openModal = () => setShowModal(true);

  return (
    <div className="fixed inset-0 bg-background overflow-hidden" dir="rtl">
      {/* Full-screen masked person background */}
      <motion.div
        className="absolute inset-0 cursor-pointer"
        onClick={openModal}
        animate={{
          scale: [1, 1.03, 1],
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      >
        <img
          src={maskedPersonImage}
          alt="شخص مقنع مرعب"
          className="w-full h-full object-cover"
        />
      </motion.div>

      {/* Dark overlay with breathing effect */}
      <motion.div
        className="absolute inset-0 bg-black/40"
        animate={{
          opacity: [0.4, 0.6, 0.4],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      {/* Beckoning hand animation overlay */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        animate={{
          background: [
            "radial-gradient(circle at 50% 50%, transparent 60%, hsl(0 85% 35% / 0.3) 100%)",
            "radial-gradient(circle at 50% 50%, transparent 50%, hsl(0 85% 35% / 0.5) 100%)",
            "radial-gradient(circle at 50% 50%, transparent 60%, hsl(0 85% 35% / 0.3) 100%)",
          ],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      {/* Fog effect */}
      <div className="absolute inset-0 pointer-events-none fog-overlay" />

      {/* "ابدأ الآن" button - centered */}
      <motion.button
        onClick={openModal}
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.5, duration: 0.8, type: "spring" }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 px-10 py-4 font-horror text-2xl
          bg-gradient-to-l from-primary to-accent text-primary-foreground
          rounded-lg border-2 border-primary shadow-lg shadow-primary/50
          cursor-pointer transition-all duration-300"
      >
        ابدأ الآن
      </motion.button>

      {/* Bottom hint text */}
      <motion.div
        className="absolute bottom-8 left-0 right-0 text-center z-20 pointer-events-none"
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        <p className="font-horror text-2xl text-primary-foreground drop-shadow-lg">
          اضغط للدخول... إن كنت تجرؤ 👻
        </p>
      </motion.div>

      {/* Google Sign-In Modal */}
      <AnimatePresence>
        {showModal && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/70 z-40"
              onClick={() => setShowModal(false)}
            />

            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none"
            >
              <div
                className="pointer-events-auto w-[90%] max-w-sm bg-card border-2 border-primary/50 
                  rounded-2xl p-8 shadow-2xl shadow-primary/30 text-center"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Modal icon */}
                <motion.div
                  animate={{ rotate: [0, 5, -5, 0] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="text-5xl mb-4"
                >
                  🎭
                </motion.div>

                <h2 className="font-horror text-3xl text-primary mb-2">
                  ألغاز المسابقة
                </h2>
                <p className="font-typewriter text-muted-foreground mb-6 text-sm">
                  سجّل دخولك للمشاركة في المسابقة
                </p>

                {/* Google Sign-In Button */}
                <motion.button
                  onClick={handleGoogleSignIn}
                  disabled={loading}
                  whileHover={{ scale: loading ? 1 : 1.05 }}
                  whileTap={{ scale: loading ? 1 : 0.95 }}
                  className="w-full flex items-center justify-center gap-3 px-6 py-4
                    bg-white text-gray-800 font-semibold text-lg rounded-xl
                    border border-gray-300 shadow-md hover:shadow-lg
                    transition-all duration-300 cursor-pointer disabled:opacity-50"
                >
                  {/* Google icon */}
                  <svg className="w-6 h-6" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  {loading ? "جاري التسجيل..." : "تابع مع جوجل"}
                </motion.button>

                {error && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="mt-4 text-sm text-destructive font-typewriter"
                  >
                    {error}
                  </motion.p>
                )}

                {/* Close button */}
                <button
                  onClick={() => setShowModal(false)}
                  className="mt-4 text-sm text-muted-foreground hover:text-foreground 
                    font-typewriter transition-colors cursor-pointer"
                >
                  إغلاق
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CompetitionIntro;
