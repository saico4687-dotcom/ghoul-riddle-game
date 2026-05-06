import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import HorrorButton from "./HorrorButton";
import { Skull, Trophy, RotateCcw, Ghost, Star, Zap, CheckCircle, Upload, AlertCircle, Loader2, XCircle } from "lucide-react";
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

type DrawStep = "result" | "form" | "instructions" | "payment" | "proof" | "reviewing" | "approved" | "rejected" | "error" | null;

const RECIPIENT_NUMBERS = [
  "01062612970",
  "01012377354",
  "01055010492",
  "01032319753",
];

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
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [rejectionReason, setRejectionReason] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Realtime subscription: listen for admin updates on payment_status while reviewing
  useEffect(() => {
    if (gameMode !== "competition" || !user) return;
    if (drawStep !== "reviewing") return;

    const channel = supabase
      .channel(`payment-status-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "competition_scores",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const newStatus = (payload.new as any)?.payment_status as string | undefined;
          if (!newStatus) return;
          if (newStatus === "تم الدفع" || newStatus === "مؤكد" || newStatus === "مقبول") {
            setDrawStep("approved");
          } else if (newStatus === "مرفوض" || newStatus === "لم يتم الدفع") {
            setRejectionReason((payload.new as any)?.extracted_text || "");
            setDrawStep("rejected");
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [gameMode, user, drawStep]);

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
          const st = data.payment_status;
          if (st === "تم الدفع" || st === "مؤكد" || st === "مقبول") {
            setDrawStep("approved");
          } else if (st === "مرفوض" || st === "لم يتم الدفع") {
            setDrawStep("rejected");
          } else if (st === "قيد المراجعة") {
            setDrawStep("reviewing");
          } else if (data.entered_draw && data.full_name) {
            setFullName(data.full_name || "");
            setPhone(data.phone || "");
            setAddress(data.address || "");
            setPaymentPhone(data.payment_phone || "");
            setDrawStep("instructions");
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
    setDrawStep("instructions");
  };

  const handlePayNow = (recipient: string) => {
    window.location.href = `tel:*9*7*${recipient}*50%23`;
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

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        const base64 = result.split(",")[1] || "";
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleSubmitProof = async () => {
    if (!proofImage || !user) return;
    setUploading(true);

    try {
      // 1) Verify the proof image with AI/OCR BEFORE uploading
      const base64 = await fileToBase64(proofImage);
      const { data: verifyData, error: verifyError } = await supabase.functions.invoke(
        "verify-payment-proof",
        { body: { imageBase64: base64, mimeType: proofImage.type } }
      );

      if (verifyError) {
        console.error("verify error:", verifyError);
        setErrorMessage("تعذر الاتصال بخدمة التحقق. حاول مرة أخرى.");
        setDrawStep("error");
        return;
      }

      if (!verifyData?.valid) {
        console.warn("payment proof rejected:", verifyData?.reason, verifyData?.message);
        setErrorMessage(verifyData?.message || "تعذر تأكيد عملية الدفع.");
        setDrawStep("error");
        return;
      }

      // Duplicate transaction check
      if (verifyData.transactionNumber) {
        const { data: dupRows } = await supabase
          .from("competition_scores")
          .select("user_id")
          .eq("transaction_number", verifyData.transactionNumber as string)
          .neq("user_id", user.id);
        if (dupRows && dupRows.length > 0) {
          setErrorMessage("رقم العملية هذا مستخدم من قبل ولا يمكن إعادة استخدامه.");
          setDrawStep("error");
          return;
        }
      }

      // 2) Upload image only after successful verification
      const ext = proofImage.name.split(".").pop();
      const filePath = `${user.id}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("payment-proofs")
        .upload(filePath, proofImage);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("payment-proofs")
        .getPublicUrl(filePath);

      const detectedDate = verifyData.extractedDateTime
        ? new Date(verifyData.extractedDateTime)
        : null;

      await supabase
        .from("competition_scores")
        .update({
          payment_proof_url: urlData.publicUrl,
          payment_date: detectedDate
            ? detectedDate.toISOString().slice(0, 10)
            : new Date().toISOString().slice(0, 10),
          payment_time: detectedDate
            ? detectedDate.toISOString().slice(11, 16)
            : new Date().toISOString().slice(11, 16),
          payment_status: "قيد المراجعة",
          extracted_text: verifyData.extractedText || null,
          transaction_number: verifyData.transactionNumber || null,
          updated_at: new Date().toISOString(),
        } as any)
        .eq("user_id", user.id);

      setDrawStep("reviewing");
    } catch (err) {
      console.error("Upload error:", err);
      setErrorMessage("حدث خطأ غير متوقع أثناء الرفع.");
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
        <div className="relative z-10 text-center px-4 max-w-md w-full py-6">
          {/* Mini result summary at top */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="card-horror p-3 mb-4 text-right border-primary/40"
            dir="rtl"
          >
            <p className="font-horror text-sm text-primary text-center mb-2">نتيجتك في المسابقة</p>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="font-horror text-lg text-primary">{score}/{totalQuestions}</div>
                <div className="font-typewriter text-[10px] text-muted-foreground">صحيحة</div>
              </div>
              <div>
                <div className="font-horror text-lg text-primary">{totalPoints}</div>
                <div className="font-typewriter text-[10px] text-muted-foreground">نقطة</div>
              </div>
              <div>
                <div className="font-horror text-lg text-yellow-400/60 blur-sm select-none" aria-hidden="true">＊＊＊</div>
                <div className="font-typewriter text-[10px] text-muted-foreground">سرعة (مخفي)</div>
              </div>
            </div>
            <p className={`font-horror text-xs text-center mt-2 ${rank.color}`}>{rank.title}</p>
          </motion.div>

          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="mb-4 inline-block"
          >
            <Loader2 className="w-16 h-16 mx-auto text-yellow-400" />
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="card-horror p-6 space-y-4 text-right" dir="rtl">
            <div className="flex items-center justify-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-yellow-400"></span>
              </span>
              <h2 className="font-horror text-2xl text-yellow-400 text-center">قيد المراجعة</h2>
            </div>
            <div className="bg-yellow-400/10 border border-yellow-400/40 rounded-lg p-3">
              <p className="font-typewriter text-sm text-foreground text-center leading-relaxed">
                طلبك تحت المراجعة من قِبَل الإدارة الآن.
                ستظهر النتيجة هنا تلقائياً بمجرد اعتماد أو رفض العملية دون الحاجة لإعادة فتح الصفحة.
              </p>
            </div>
            <p className="font-typewriter text-xs text-muted-foreground leading-relaxed text-center">
              تم قفل ألغاز المسابقة من حسابك. سيتم إعلان نتيجة السحب خلال أسبوع.
            </p>
            <div className="pt-2 text-center">
              <button onClick={onRestart} className="font-typewriter text-sm text-muted-foreground hover:text-foreground transition-colors">
                العودة للقائمة الرئيسية
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  // === APPROVED STATE ===
  if (gameMode === "competition" && drawStep === "approved") {
    return (
      <div className="min-h-screen bg-horror-gradient relative overflow-hidden flex items-center justify-center" dir="rtl">
        <div className="vignette" />
        <div className="fog-overlay" />
        <div className="relative z-10 text-center px-4 max-w-md">
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring" }}>
            <CheckCircle className="w-20 h-20 mx-auto text-green-400 mb-6" />
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="card-horror p-6 space-y-4 text-right border-green-400/40" dir="rtl">
            <h2 className="font-horror text-2xl text-green-400 text-center">تم اعتماد الدفع ✅</h2>
            <p className="font-typewriter text-base text-foreground leading-relaxed text-center">
              تم تأكيد عملية الدفع وإدراج اشتراكك في السحب الأسبوعي بنجاح.
            </p>
            <p className="font-typewriter text-sm text-foreground/90 leading-relaxed">
              سيتم إعلان نتيجة السحب خلال أسبوع. قد تكون من الفائزين بالهدايا (عمرة أو إقامة أسبوع بفندق على شاطئ البحر) أو يتم إدراج رقمك ضمن الأرقام المعتمدة لاستقبال التحويلات في السحوبات القادمة.
            </p>
            <HorrorButton onClick={onRestart}>
              العودة للقائمة الرئيسية
            </HorrorButton>
          </motion.div>
        </div>
      </div>
    );
  }

  // === REJECTED STATE ===
  if (gameMode === "competition" && drawStep === "rejected") {
    return (
      <div className="min-h-screen bg-horror-gradient relative overflow-hidden flex items-center justify-center" dir="rtl">
        <div className="vignette" />
        <div className="fog-overlay" />
        <div className="relative z-10 text-center px-4 max-w-md">
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring" }}>
            <XCircle className="w-20 h-20 mx-auto text-red-400 mb-6" />
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="card-horror p-6 space-y-4 border-red-400/40">
            <h2 className="font-horror text-2xl text-red-400 text-center">تم رفض الدفع ❌</h2>
            <p className="font-typewriter text-base text-foreground leading-relaxed text-center">
              تم رفض إثبات الدفع من قِبَل الإدارة.
            </p>
            {rejectionReason && (
              <div className="bg-red-400/10 border border-red-400/40 rounded-lg p-3">
                <p className="font-typewriter text-xs text-foreground/90 text-center leading-relaxed">
                  {rejectionReason}
                </p>
              </div>
            )}
            <p className="font-typewriter text-xs text-muted-foreground text-center leading-relaxed">
              يمكنك إعادة المحاولة برفع صورة إثبات صحيحة وغير معدّلة لأحد الأرقام المعتمدة.
            </p>
            <HorrorButton onClick={() => { setDrawStep("instructions"); setProofImage(null); setProofPreview(null); }}>
              إعادة المحاولة
            </HorrorButton>
            <button onClick={onRestart} className="block mx-auto font-typewriter text-sm text-muted-foreground hover:text-foreground transition-colors">
              العودة للقائمة الرئيسية
            </button>
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
            <h2 className="font-horror text-2xl text-red-400 text-center">لم يتم الدفع</h2>
            <p className="font-typewriter text-base text-foreground leading-relaxed text-center">
              {errorMessage || "تعذر تأكيد عملية الدفع، يرجى التأكد من صحة الصورة والبيانات."}
            </p>
            <p className="font-typewriter text-xs text-muted-foreground text-center">
              تأكد أن الصورة لقطة شاشة حقيقية (غير معدّلة) وتحتوي على رقم العملية وتاريخها وأن التحويل تم لأحد الأرقام المعتمدة.
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

            <p className="font-typewriter text-xs text-muted-foreground leading-relaxed text-center">
              سيتم تحليل الصورة تلقائياً للتحقق من بيانات العملية (التاريخ، الوقت، رقم المستلم).
            </p>


            <HorrorButton 
              onClick={handleSubmitProof} 
              disabled={uploading || !proofImage}
            >
              {uploading ? "جاري التحقق..." : "إرسال إثبات الدفع"}
            </HorrorButton>
          </motion.div>
        </div>
      </div>
    );
  }

  // === INSTRUCTIONS STEP (before payment) ===
  if (gameMode === "competition" && drawStep === "instructions") {
    return (
      <div className="min-h-screen bg-horror-gradient relative overflow-hidden flex items-center justify-center py-8" dir="rtl">
        <div className="vignette" />
        <div className="fog-overlay" />
        <div className="relative z-10 w-full max-w-md px-4">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card-horror p-6 space-y-4 text-right">
            <h2 className="font-horror text-2xl text-primary text-center">تعليمات الدفع</h2>

            <p className="font-typewriter text-sm text-foreground leading-relaxed">
              قبل إتمام الدفع يرجى قراءة التعليمات بعناية:
            </p>

            <ul className="font-typewriter text-sm text-foreground/90 leading-relaxed space-y-2 list-disc pr-5">
              <li>رسوم الاشتراك في السحب الأسبوعي: <span className="text-primary font-bold">50 جنيه</span> فقط.</li>
              <li>يجب التحويل إلى أحد الأرقام المعتمدة التالية فقط، وأي تحويل لرقم آخر سيُرفض تلقائياً:</li>
              <li className="list-none">
                <div className="bg-secondary/50 border border-primary/30 rounded-lg p-3 space-y-1 mt-1">
                  {RECIPIENT_NUMBERS.map((n) => (
                    <div key={n} className="font-typewriter text-base text-primary text-center tracking-wider" dir="ltr">{n}</div>
                  ))}
                </div>
              </li>
              <li>بعد التحويل احتفظ بصورة الإشعار التي تحتوي على <span className="text-primary">رقم العملية</span> و<span className="text-primary">تاريخ ووقت العملية</span> ورقم المستلم.</li>
              <li>سيقوم الذكاء الاصطناعي الاحترافي بمراجعة الصورة، ولن يقبل التطبيق أي صورة معدّلة أو مولّدة بالذكاء الاصطناعي.</li>
              <li>كل رقم عملية يصلح للاستخدام مرة واحدة فقط ولا يمكن تكراره.</li>
              <li>بعد تأكيد الدفع يتم <span className="text-primary">قفل ألغاز المسابقة</span> من حسابك وعرض درجتك النهائية بانتظار إعلان نتائج السحب الأسبوعي.</li>
              <li className="list-none">
                <div className="border border-primary/30 rounded-lg p-3 mt-2 space-y-2 bg-secondary/30">
                  <p className="font-horror text-base text-primary text-center">آلية اختيار الفائزين</p>
                  <p className="leading-relaxed">
                    يتم اختيار الفائزين بناءً على <span className="text-primary">أسرع إجابة صحيحة</span> ضمن المشتركين الذين أتموا الدفع، وذلك على النحو التالي:
                  </p>
                  <p className="leading-relaxed">
                    <span className="text-primary font-bold">• الدرجة 50% فأعلى:</span> يحصل صاحب أسرع إجابة صحيحة على إحدى الجوائز التالية حسب الاختيار: <span className="text-primary">عمرة</span> أو <span className="text-primary">إقامة لمدة أسبوع</span> في فندق على أقرب شاطئ بحري إليه.
                  </p>
                  <p className="leading-relaxed">
                    <span className="text-primary font-bold">• الدرجة أقل من 50%:</span> يحصل صاحب أسرع إجابة صحيحة على شرف <span className="text-primary">إدراج رقمه ضمن أرقام التحويل المعتمدة</span> لاستقبال رسوم الاشتراكات في السحوبات القادمة.
                  </p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    ملاحظة: يتم تسجيل زمن إجابتك تلقائياً في قاعدة البيانات، ويُعرض ترتيب أسرع المتسابقين لمالك التطبيق لاعتماد الفائزين بشفافية كاملة.
                  </p>
                </div>
              </li>
            </ul>

            <div className="space-y-2">
              <p className="font-typewriter text-sm text-muted-foreground text-center">مثال على شكل إشعار التحويل المقبول:</p>
              <img
                src="/payment-proof-example.jpg"
                alt="مثال إشعار التحويل"
                className="w-full max-h-80 object-contain rounded-lg border border-primary/30"
              />
            </div>

            <HorrorButton onClick={() => setDrawStep("payment")}>
              فهمت، المتابعة للدفع
            </HorrorButton>
            <div className="pt-2 text-center">
              <button onClick={onRestart} className="font-typewriter text-sm text-muted-foreground hover:text-foreground transition-colors">
                العودة للقائمة الرئيسية
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  // === PAYMENT STEP ===
  if (gameMode === "competition" && drawStep === "payment") {
    return (
      <div className="min-h-screen bg-horror-gradient relative overflow-hidden flex items-center justify-center py-8" dir="rtl">
        <div className="vignette" />
        <div className="fog-overlay" />
        <div className="relative z-10 w-full max-w-md px-4">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card-horror p-6 space-y-4 text-right">
            <h2 className="font-horror text-2xl text-primary text-center">إتمام الدفع</h2>
            <p className="font-typewriter text-sm text-foreground leading-relaxed text-center">
              اختر أحد أرقام المستلمين المعتمدة لتحويل <span className="text-primary font-bold">50 جنيه</span> عبر فودافون كاش:
            </p>

            <div className="space-y-2">
              {RECIPIENT_NUMBERS.map((n) => (
                <button
                  key={n}
                  onClick={() => handlePayNow(n)}
                  className="w-full bg-secondary/60 border border-primary/40 hover:border-primary rounded-lg p-3 font-typewriter text-base text-primary tracking-wider transition-colors"
                  dir="ltr"
                >
                  💳 {n}
                </button>
              ))}
            </div>

            <p className="font-typewriter text-xs text-muted-foreground text-center leading-relaxed">
              بعد إتمام التحويل من تطبيق فودافون كاش، عُد إلى التطبيق واضغط "تم الدفع" لرفع صورة إثبات الدفع.
            </p>

            <HorrorButton onClick={() => setDrawStep("proof")}>
              ✅ تم الدفع — رفع الإثبات
            </HorrorButton>
            <div className="pt-2 text-center">
              <button onClick={() => setDrawStep("instructions")} className="font-typewriter text-sm text-muted-foreground hover:text-foreground transition-colors">
                الرجوع للتعليمات
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
              🎯 المتابعة لتعليمات الدفع والسحب
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
