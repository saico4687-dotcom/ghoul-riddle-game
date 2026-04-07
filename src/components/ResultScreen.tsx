import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import HorrorButton from "./HorrorButton";
import { Skull, Trophy, RotateCcw, Ghost, Star, Zap, CheckCircle, Upload, AlertCircle } from "lucide-react";
import { GameMode } from "./WelcomeScreen";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface ResultScreenProps {
  score: number;
  totalQuestions: number;
  totalPoints: number;
  maxPoints: number;
  timeBonus: number;
  rank: { title: string; color: string };
  gameMode: GameMode;
  onRestart: () => void;
}

type DrawStep = "result" | "form" | "payment" | "proof" | "reviewing" | "error" | null;

const ResultScreen = ({ 
  score, 
  totalQuestions, 
  totalPoints,
  maxPoints,
  timeBonus,
  rank,
  gameMode,
  onRestart 
}: ResultScreenProps) => {
  const { user } = useAuth();
  const percentage = (score / totalQuestions) * 100;
  const pointsPercentage = (totalPoints / maxPoints) * 100;

  const [drawStep, setDrawStep] = useState<DrawStep>(null);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [paymentPhone, setPaymentPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [proofImage, setProofImage] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [paymentDate, setPaymentDate] = useState("");
  const [paymentTime, setPaymentTime] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check if user already has data saved (returning user)
  useEffect(() => {
    if (gameMode === "competition" && user) {
      (async () => {
        const { data } = await supabase
          .from("competition_scores")
          .select("entered_draw, payment_status, full_name, phone, address, payment_phone")
          .eq("user_id", user.id)
          .single();
        
        if (data) {
          if (data.payment_status === "قيد المراجعة") {
            setDrawStep("reviewing");
          } else if (data.entered_draw && data.full_name) {
            // Already filled form, go to payment step
            setFullName(data.full_name || "");
            setPhone(data.phone || "");
            setAddress(data.address || "");
            setPaymentPhone(data.payment_phone || "");
            setDrawStep("payment");
          }
        }
      })();
    }
  }, [gameMode, user]);
  
  const getMessage = () => {
    if (percentage === 100) {
      return { title: "عبقري الرعب! 🏆", subtitle: "أنت سيد الألغاز المرعبة!" };
    } else if (percentage >= 70) {
      return { title: "مخيف جداً! 👻", subtitle: "أداء رائع في عالم الرعب" };
    } else if (percentage >= 50) {
      return { title: "لا بأس! 💀", subtitle: "تحتاج المزيد من الشجاعة" };
    } else {
      return { title: "مرعوب! 😱", subtitle: "الألغاز أخافتك!" };
    }
  };

  const { title, subtitle } = getMessage();

  const handleSaveData = async () => {
    if (!fullName.trim() || !phone.trim() || !address.trim() || !paymentPhone.trim()) return;
    if (!user) return;
    setSaving(true);

    const { data: existing } = await supabase
      .from("competition_scores")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (existing) {
      await supabase
        .from("competition_scores")
        .update({
          total_points: totalPoints,
          total_correct: score,
          total_questions: totalQuestions,
          time_bonus: timeBonus,
          full_name: fullName.trim(),
          phone: phone.trim(),
          address: address.trim(),
          payment_phone: paymentPhone.trim(),
          email: user.email || "",
          entered_draw: true,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);
    } else {
      await supabase
        .from("competition_scores")
        .insert({
          user_id: user.id,
          total_points: totalPoints,
          total_correct: score,
          total_questions: totalQuestions,
          time_bonus: timeBonus,
          full_name: fullName.trim(),
          phone: phone.trim(),
          address: address.trim(),
          payment_phone: paymentPhone.trim(),
          email: user.email || "",
          entered_draw: true,
        });
    }

    setSaving(false);
    setDrawStep("payment");
  };

  const handlePayNow = () => {
    window.location.href = "tel:*9*7*01062612970*50%23";
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setProofImage(file);
      const reader = new FileReader();
      reader.onloadend = () => setProofPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSubmitProof = async () => {
    if (!proofImage || !paymentDate || !paymentTime || !user) return;
    setUploading(true);

    try {
      // Upload image
      const ext = proofImage.name.split('.').pop();
      const filePath = `${user.id}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("payment-proofs")
        .upload(filePath, proofImage);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("payment-proofs")
        .getPublicUrl(filePath);

      // Update competition_scores with proof
      await supabase
        .from("competition_scores")
        .update({
          payment_proof_url: urlData.publicUrl,
          payment_date: paymentDate,
          payment_time: paymentTime,
          payment_status: "قيد المراجعة",
          updated_at: new Date().toISOString(),
        } as any)
        .eq("user_id", user.id);

      setDrawStep("reviewing");
    } catch (err) {
      console.error("Upload error:", err);
      setDrawStep("error");
    } finally {
      setUploading(false);
    }
  };

  // === REVIEWING STATE ===
  if (gameMode === "competition" && drawStep === "reviewing") {
    return (
      <div className="min-h-screen bg-horror-gradient relative overflow-hidden flex items-center justify-center" dir="rtl">
        <div className="vignette" />
        <div className="fog-overlay" />
        <div className="relative z-10 text-center px-4 max-w-md">
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring" }}>
            <CheckCircle className="w-20 h-20 mx-auto text-green-400 mb-6" />
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="card-horror p-6 space-y-4">
            <p className="font-typewriter text-lg text-foreground leading-relaxed">
              تم استلام طلبك بنجاح، وجاري مراجعة عملية الدفع للتأكيد.
            </p>
            <div className="pt-2">
              <button onClick={onRestart} className="font-typewriter text-sm text-muted-foreground hover:text-foreground transition-colors">
                العودة للقائمة الرئيسية
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  // === ERROR STATE ===
  if (gameMode === "competition" && drawStep === "error") {
    return (
      <div className="min-h-screen bg-horror-gradient relative overflow-hidden flex items-center justify-center" dir="rtl">
        <div className="vignette" />
        <div className="fog-overlay" />
        <div className="relative z-10 text-center px-4 max-w-md">
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring" }}>
            <AlertCircle className="w-20 h-20 mx-auto text-red-400 mb-6" />
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="card-horror p-6 space-y-4">
            <p className="font-typewriter text-lg text-foreground leading-relaxed">
              تعذر تأكيد عملية الدفع، يرجى التأكد من صحة البيانات والمحاولة مرة أخرى.
            </p>
            <HorrorButton onClick={onRestart}>
              الرجوع إلى القائمة الرئيسية
            </HorrorButton>
          </motion.div>
        </div>
      </div>
    );
  }

  // === PROOF UPLOAD STEP ===
  if (gameMode === "competition" && drawStep === "proof") {
    return (
      <div className="min-h-screen bg-horror-gradient relative overflow-hidden flex items-center justify-center" dir="rtl">
        <div className="vignette" />
        <div className="fog-overlay" />
        <div className="relative z-10 w-full max-w-md px-4">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card-horror p-6 space-y-4">
            <h2 className="font-horror text-2xl text-primary text-center mb-4">إثبات الدفع</h2>
            
            {/* Upload area */}
            <div>
              <label className="font-typewriter text-sm text-muted-foreground block mb-1">صورة إثبات الدفع *</label>
              <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full border-2 border-dashed border-primary/40 rounded-lg p-6 flex flex-col items-center gap-2 hover:border-primary/70 transition-colors"
              >
                {proofPreview ? (
                  <img src={proofPreview} alt="proof" className="max-h-40 rounded-lg object-contain" />
                ) : (
                  <>
                    <Upload className="w-10 h-10 text-primary/60" />
                    <span className="font-typewriter text-sm text-muted-foreground">اضغط لرفع الصورة</span>
                  </>
                )}
              </button>
            </div>

            <div>
              <label className="font-typewriter text-sm text-muted-foreground block mb-1">تاريخ العملية *</label>
              <input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} className="w-full bg-background border border-primary/30 rounded-lg px-3 py-2 font-typewriter text-sm text-foreground focus:outline-none focus:border-primary" />
            </div>

            <div>
              <label className="font-typewriter text-sm text-muted-foreground block mb-1">وقت العملية *</label>
              <input type="time" value={paymentTime} onChange={(e) => setPaymentTime(e.target.value)} className="w-full bg-background border border-primary/30 rounded-lg px-3 py-2 font-typewriter text-sm text-foreground focus:outline-none focus:border-primary" />
            </div>

            <HorrorButton 
              onClick={handleSubmitProof} 
              disabled={uploading || !proofImage || !paymentDate || !paymentTime}
            >
              {uploading ? "جاري الرفع..." : "إرسال إثبات الدفع"}
            </HorrorButton>
          </motion.div>
        </div>
      </div>
    );
  }

  // === PAYMENT STEP ===
  if (gameMode === "competition" && drawStep === "payment") {
    return (
      <div className="min-h-screen bg-horror-gradient relative overflow-hidden flex items-center justify-center" dir="rtl">
        <div className="vignette" />
        <div className="fog-overlay" />
        <div className="relative z-10 text-center px-4 max-w-md">
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring" }}>
            <CheckCircle className="w-20 h-20 mx-auto text-green-400 mb-6" />
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="card-horror p-6 space-y-4">
            <p className="font-typewriter text-base text-foreground leading-relaxed">
              لإتمام الاشتراك في السحب، يرجى سداد رسوم الاشتراك (50 جنيه).
              <br /><br />
              بعد إتمام عملية الدفع، يُرجى العودة إلى التطبيق لاستكمال خطوات تأكيد الدفع.
              <br /><br />
              يجب إرفاق لقطة شاشة واضحة تحتوي على تاريخ ووقت العملية، حيث يتم مراجعة البيانات للتأكد من صحتها قبل تأكيد الاشتراك.
            </p>
            <HorrorButton onClick={handlePayNow}>
              💳 الدفع الآن
            </HorrorButton>
            <HorrorButton onClick={() => setDrawStep("proof")}>
              ✅ تم الدفع
            </HorrorButton>
            <div className="pt-2">
              <button onClick={onRestart} className="font-typewriter text-sm text-muted-foreground hover:text-foreground transition-colors">
                العودة للقائمة الرئيسية
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  // === FORM STEP ===
  if (gameMode === "competition" && drawStep === "form") {
    return (
      <div className="min-h-screen bg-horror-gradient relative overflow-hidden flex items-center justify-center" dir="rtl">
        <div className="vignette" />
        <div className="fog-overlay" />
        <div className="relative z-10 w-full max-w-md px-4">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card-horror p-6 space-y-4">
            <h2 className="font-horror text-2xl text-primary text-center mb-4">بيانات الاشتراك في السحب</h2>
            
            <div>
              <label className="font-typewriter text-sm text-muted-foreground block mb-1">النتيجة</label>
              <input readOnly value={`${score} / ${totalQuestions} — ${totalPoints} نقطة`} className="w-full bg-secondary/50 border border-primary/30 rounded-lg px-3 py-2 font-typewriter text-sm text-foreground/70 cursor-not-allowed" />
            </div>

            <div>
              <label className="font-typewriter text-sm text-muted-foreground block mb-1">البريد الإلكتروني</label>
              <input readOnly value={user?.email || ""} className="w-full bg-secondary/50 border border-primary/30 rounded-lg px-3 py-2 font-typewriter text-sm text-foreground/70 cursor-not-allowed" />
            </div>

            <div>
              <label className="font-typewriter text-sm text-muted-foreground block mb-1">الاسم الكامل *</label>
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="أدخل اسمك الكامل" className="w-full bg-background border border-primary/30 rounded-lg px-3 py-2 font-typewriter text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary" />
            </div>

            <div>
              <label className="font-typewriter text-sm text-muted-foreground block mb-1">رقم الهاتف *</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="أدخل رقم هاتفك" type="tel" className="w-full bg-background border border-primary/30 rounded-lg px-3 py-2 font-typewriter text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary" />
            </div>

            <div>
              <label className="font-typewriter text-sm text-muted-foreground block mb-1">العنوان *</label>
              <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="أدخل عنوانك" className="w-full bg-background border border-primary/30 rounded-lg px-3 py-2 font-typewriter text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary" />
            </div>

            <div>
              <label className="font-typewriter text-sm text-muted-foreground block mb-1">رقم هاتف الدفع *</label>
              <input value={paymentPhone} onChange={(e) => setPaymentPhone(e.target.value)} placeholder="رقم المحفظة للدفع" type="tel" className="w-full bg-background border border-primary/30 rounded-lg px-3 py-2 font-typewriter text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary" />
            </div>

            <HorrorButton 
              onClick={handleSaveData} 
              disabled={saving || !fullName.trim() || !phone.trim() || !address.trim() || !paymentPhone.trim()}
            >
              {saving ? "جاري الحفظ..." : "تأكيد البيانات"}
            </HorrorButton>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-horror-gradient relative overflow-hidden flex items-center justify-center">
      {/* Vignette */}
      <div className="vignette" />
      
      {/* Fog Overlay */}
      <div className="fog-overlay" />

      {/* Floating Skulls */}
      {[...Array(5)].map((_, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 100 }}
          animate={{
            opacity: [0, 0.3, 0],
            y: [-100, -500],
            x: Math.sin(i) * 100,
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            delay: i * 0.8,
            ease: "easeOut",
          }}
          className="absolute bottom-0 text-primary/20"
          style={{ left: `${20 + i * 15}%` }}
        >
          <Skull className="w-12 h-12" />
        </motion.div>
      ))}

      <div className="relative z-10 text-center px-4 max-w-2xl">
        {/* Game Mode Badge */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <div className={`inline-block px-6 py-2 rounded-lg font-horror text-lg ${
            gameMode === "fun" 
              ? "bg-green-900/80 text-green-300 border border-green-500" 
              : "bg-red-900/80 text-red-300 border border-red-500"
          }`}>
            {gameMode === "fun" ? "🎮 ألغاز المتعة" : "🏆 ألغاز المسابقة"}
          </div>
        </motion.div>

        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", duration: 0.8 }}
        >
          {percentage >= 70 ? (
            <Trophy className="w-24 h-24 mx-auto text-primary mb-8 flicker" />
          ) : (
            <Ghost className="w-24 h-24 mx-auto text-primary mb-8 flicker" />
          )}
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="font-horror text-5xl md:text-7xl text-blood pulse-blood mb-4"
        >
          {title}
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="font-typewriter text-xl text-foreground/80 mb-4"
        >
          {subtitle}
        </motion.p>

        {/* Rank Display */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.6 }}
          className="mb-6"
        >
          <p className="font-typewriter text-muted-foreground mb-2">ترتيبك:</p>
          <p className={`font-horror text-3xl ${rank.color}`}>{rank.title}</p>
        </motion.div>

        {/* Stats Cards */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.7 }}
          className="grid grid-cols-2 gap-4 mb-8"
        >
          <div className="card-horror p-4">
            <Star className="w-8 h-8 mx-auto text-yellow-400 mb-2" />
            <div className="font-horror text-4xl text-primary">{score}/{totalQuestions}</div>
            <div className="font-typewriter text-sm text-muted-foreground">إجابات صحيحة</div>
          </div>
          
          <div className="card-horror p-4">
            <Trophy className="w-8 h-8 mx-auto text-purple-400 mb-2" />
            <div className="font-horror text-4xl text-primary">{totalPoints}</div>
            <div className="font-typewriter text-sm text-muted-foreground">نقطة</div>
          </div>
        </motion.div>

        {/* Time Bonus */}
        {timeBonus > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="card-horror p-3 mb-6 inline-flex items-center gap-2"
          >
            <Zap className="w-5 h-5 text-yellow-400" />
            <span className="font-typewriter text-sm text-yellow-400">
              +{timeBonus} نقاط إضافية للسرعة!
            </span>
          </motion.div>
        )}

        {/* Score Bar */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9 }}
          className="w-full max-w-md mx-auto mb-8"
        >
          <div className="h-4 bg-secondary rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${pointsPercentage}%` }}
              transition={{ delay: 1, duration: 1.5, ease: "easeOut" }}
              className="h-full bg-gradient-to-r from-horror-blood to-primary"
              style={{
                boxShadow: "0 0 15px hsl(var(--horror-glow) / 0.5)",
              }}
            />
          </div>
          <p className="font-typewriter text-muted-foreground mt-2">
            {totalPoints} / {maxPoints} نقطة ممكنة
          </p>
        </motion.div>

        {/* Competition draw entry message */}
        {gameMode === "competition" && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.1 }}
            className="card-horror p-5 mb-6 text-right"
            dir="rtl"
          >
            <p className="font-typewriter text-base text-foreground leading-relaxed">
              أحسنت! لقد أنهيت المسابقة 🎉
              <br />
              نتيجتك تؤهلك لدخول السحب على الجائزة.
              <br /><br />
              للدخول في السحب، يرجى تسجيل بياناتك واستكمال رسوم الاشتراك (50 جنيه) لإتمام المشاركة.
            </p>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.2 }}
          className="space-y-3"
        >
          {gameMode === "competition" && (
            <HorrorButton onClick={() => setDrawStep("form")}>
              🎯 الدخول في السحب
            </HorrorButton>
          )}
          <HorrorButton onClick={onRestart}>
            <span className="flex items-center gap-3">
              <RotateCcw className="w-5 h-5" />
              العودة للقائمة الرئيسية
            </span>
          </HorrorButton>
        </motion.div>
      </div>
    </div>
  );
};

export default ResultScreen;
