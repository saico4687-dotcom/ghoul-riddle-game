import { useState } from "react";
import { motion } from "framer-motion";
import { Send, CheckCircle, Trophy } from "lucide-react";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import HorrorButton from "./HorrorButton";

interface QuizResultSubmissionProps {
  score: number;
  totalQuestions: number;
  totalPoints: number;
  onRestart: () => void;
}

const QuizResultSubmission = ({
  score,
  totalQuestions,
  totalPoints,
  onRestart,
}: QuizResultSubmissionProps) => {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!name.trim() || !phone.trim()) {
      setError("يرجى ملء جميع الحقول");
      return;
    }

    setError("");
    setLoading(true);

    const { error: dbError } = await supabase.from("quiz_results").insert({
      name: name.trim(),
      phone: phone.trim(),
      score: totalPoints,
    });

    setLoading(false);

    if (dbError) {
      setError("حدث خطأ، يرجى المحاولة مرة أخرى");
      return;
    }

    setSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-horror-gradient relative overflow-hidden flex items-center justify-center" dir="rtl">
      <div className="vignette" />
      <div className="fog-overlay" />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-md mx-auto px-6"
      >
        <div className="card-horror p-8 space-y-6">
          {/* Score Display */}
          <div className="text-center space-y-3">
            <Trophy className="w-16 h-16 mx-auto text-primary flicker" />
            <h1 className="font-horror text-4xl text-blood pulse-blood">نتيجتك النهائية</h1>
            <div className="font-horror text-5xl text-primary">{totalPoints}</div>
            <p className="font-typewriter text-muted-foreground">
              {score} إجابة صحيحة من {totalQuestions}
            </p>
          </div>

          {submitted ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center space-y-4 py-4"
            >
              <CheckCircle className="w-16 h-16 mx-auto text-green-400" />
              <p className="font-typewriter text-xl text-green-400">
                تم إرسال نتيجتك بنجاح
              </p>
              <div className="pt-4">
                <HorrorButton onClick={onRestart}>
                  العودة للقائمة الرئيسية
                </HorrorButton>
              </div>
            </motion.div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="font-typewriter text-sm text-foreground/80">الاسم الكامل</label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="أدخل اسمك الكامل"
                  className="bg-secondary/50 border-primary/30 text-foreground font-typewriter text-right"
                />
              </div>

              <div className="space-y-2">
                <label className="font-typewriter text-sm text-foreground/80">رقم الهاتف</label>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="أدخل رقم هاتفك"
                  type="tel"
                  className="bg-secondary/50 border-primary/30 text-foreground font-typewriter text-right"
                  dir="ltr"
                />
              </div>

              {error && (
                <p className="font-typewriter text-sm text-red-400 text-center">{error}</p>
              )}

              <HorrorButton onClick={handleSubmit} disabled={loading}>
                <span className="flex items-center justify-center gap-2">
                  <Send className="w-5 h-5" />
                  {loading ? "جاري الإرسال..." : "إرسال النتيجة"}
                </span>
              </HorrorButton>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default QuizResultSubmission;
