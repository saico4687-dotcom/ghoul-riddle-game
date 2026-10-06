import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Riddle } from "@/data/riddles";

import TypewriterText from "./TypewriterText";
import RiddleOption from "./RiddleOption";
import HorrorButton from "./HorrorButton";
import HorrorClock from "./HorrorClock";
import HelpFriend from "@/components/help/HelpFriend";

import { Brain, Mic, MicOff, Scissors, Clock, Volume2, VolumeX } from "lucide-react";

import { useHorrorSounds } from "@/hooks/useHorrorSounds";
import { useHorrorBackgroundMusic } from "@/hooks/useHorrorBackgroundMusic";
import { usePurchases } from "@/hooks/usePurchases";

import { showRewarded, showBannerAd, hideBannerAd } from "@/lib/adsMediation";
import {
  fiftyOnServer,
  startRiddleOnServer,
  submitAnswerToServer,
  type ServerAnswerResult,
} from "@/lib/serverAnswers";

import moneyBg from "@/assets/money-bg.jpg";
import riddleCompetitionVideo from "@/assets/riddle-competition.mp4";

interface RiddleCardProps {
  riddle: Riddle;
  riddleNumber: number;
  totalRiddles: number;
  onAnswer: (
    isCorrect: boolean,
    selectedIndex: number | null,
    remainingTime?: number,
    elapsedMs?: number | null,
  ) => void;
  onNext: () => void;
  onExitToHome?: () => void;
  gameMode: "fun" | "competition";
  // true للمستخدم المسجّل: السيرفر هو اللي يصحّح ويحسب الزمن ويسجّل النقاط
  // ويحذف الإجابتين (التطبيق نفسه مبيعرفش الإجابة الصحيحة).
  serverTracking?: boolean;
  // معرّف المستخدم (لزر "استعن بصديق" وأزرار الإبلاغ والحظر).
  userId?: string;
  // بتتنادى لما رد السيرفر يوصل (النقاط والمجموع الرسمي).
  onServerResult?: (result: ServerAnswerResult) => void;
  // true أثناء عرض إعلان فاصل أو شاشة العرض التسويقي — يوقف الساعة
  // تمامًا، يوقف كتابة اللغز، ويمنع أي تفاعل مع الخيارات لحد ما
  // يختفي الإعلان/الشاشة.
  paused?: boolean;
  // true وقت ظهور شاشة العرض التسويقي (OfferWall) — لازم نقفل إعلان
  // البانر فورًا طول ما هي ظاهرة (ممنوع ظهور أي إعلان في نفس وقتها)،
  // ونرجّعه تلقائي بعد ما تقفل (لو المستخدم لسه ملوش no_ads).
  bannerSuppressed?: boolean;
}

const RiddleCard = ({
  riddle,
  riddleNumber,
  totalRiddles,
  onAnswer,
  onNext,
  onExitToHome,
  gameMode,
  serverTracking = false,
  userId,
  onServerResult,
  paused = false,
  bannerSuppressed = false,
}: RiddleCardProps) => {

  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [isTypingComplete, setIsTypingComplete] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  // صوت الفيديو بيبدأ مكتوم افتراضيًا (منفصل عن حالة صوت اللعبة العامة)،
  // لكن بيتزامن بالكامل مع الزرار التاني بعد كده في الاتجاهين.
  const [videoMuted, setVideoMuted] = useState(true);
  const [lifelineUsed, setLifelineUsed] = useState<null | "fifty" | "time">(null);
  const [removedOptions, setRemovedOptions] = useState<number[]>([]);
  const [extraTime, setExtraTime] = useState(0);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [adPaused, setAdPaused] = useState(false);
  // نتيجة السيرفر: null = لسه / مفيش نتيجة.
  const [serverCorrect, setServerCorrect] = useState<boolean | null>(null);
  const [serverExplanation, setServerExplanation] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  // استعن بصديق: التلميح (نص الخيار اللي اختاره المساعد) + حالة "المساعدة شغالة".
  const [hintText, setHintText] = useState<string | null>(null);
  const [helpBusy, setHelpBusy] = useState(false);
  const helpStartRef = useRef<number | null>(null);

  // وعد تسجيل بداية اللغز على السيرفر — بنستناه قبل إرسال الإجابة عشان الترتيب يبقى سليم.
  const startPromiseRef = useRef<Promise<boolean> | null>(null);

  const { playSound, setMuted } = useHorrorSounds();
  const { setVolume: setMusicVolume, startMusic, stopMusic, pauseMusic, resumeMusic } = useHorrorBackgroundMusic();
  const videoRef = useRef<HTMLVideoElement>(null);
  const { purchasedRewardUnlock, purchasedNoAds, helpPassTier } = usePurchases();

  const handleMuteToggle = () => {
    const newMutedState = !isMuted;
    setIsMuted(newMutedState);
    setMuted(newMutedState);
    setMusicVolume(newMutedState ? 0 : 0.5);
    // لو صوت اللعبة اتفتح، صوت الفيديو لازم يتكتم عشان الصوتين
    // ميشتغلوش مع بعض في نفس الوقت.
    if (!newMutedState) {
      setVideoMuted(true);
    }
  };

  // زرار صوت الفيديو بس — مستقل عن زرار اللعبة. الموسيقى بس هي اللي
  // بتتكتم عشان متتعارضش مع صوت الفيديو، أما صوت الإجابة صح/غلط
  // (Yes/Noo) فبيفضل شغال عادي مع صوت الفيديو زي ما بيشتغل مع الموسيقى.
  const handleVideoMuteToggle = () => {
    const newMutedState = !videoMuted;
    setVideoMuted(newMutedState);
    if (!newMutedState) {
      setIsMuted(true);
      setMusicVolume(0);
    }
  };

  // لما "paused" تبقى true (خرجنا للخلفية، أو فتح إعلان/شاشة عرض)
  // نوقف الفيديو والموسيقى فورًا زي ما بيحصل مع الساعة بالظبط، وبيرجعوا
  // يشتغلوا تاني تلقائي لحظة ما نرجع للتطبيق.
  useEffect(() => {
    const video = videoRef.current;
    if (paused) {
      video?.pause();
      pauseMusic();
    } else {
      if (video && video.paused) {
        void video.play().catch(() => {});
      }
      resumeMusic();
    }
  }, [paused, pauseMusic, resumeMusic]);

  useEffect(() => {
    setSelectedOption(null);
    setShowResult(false);
    setIsTypingComplete(false);
    setLifelineUsed(null);
    setRemovedOptions([]);
    setExtraTime(0);
    setStartTime(null);
    setServerCorrect(null);
    setServerExplanation(null);
    setSubmitting(false);
    setSubmitError(null);
    setHintText(null);
    setHelpBusy(false);
    helpStartRef.current = null;
    startPromiseRef.current = null;
    nextCalledRef.current = false;
    if (autoNextTimerRef.current) {
      clearTimeout(autoNextTimerRef.current);
      autoNextTimerRef.current = null;
    }

    // موسيقى اللغز اللي فات لازم توقف مع أول لغز جديد.
    stopMusic();
    playSound("ambient");
  }, [riddle, playSound, stopMusic]);

  // بيضمن onNext ميتنادوش غير مرة واحدة لكل لغز — لو المستخدم ضغط
  // "اللغز التالي" يدويًا قبل ما الـ setTimeout التلقائي (بعد إجابة
  // غلط) يطلق، كان بيحصل نداءين لـ onNext على نفس اللغز، وده سبب
  // ظهور الإعلان البيني مرتين على نفس اللغز.
  const nextCalledRef = useRef(false);
  const autoNextTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const goNext = () => {
    if (nextCalledRef.current) return;
    nextCalledRef.current = true;
    if (autoNextTimerRef.current) {
      clearTimeout(autoNextTimerRef.current);
      autoNextTimerRef.current = null;
    }
    onNext();
  };

  useEffect(() => {
    if (isTypingComplete && startTime === null) {
      setStartTime(Date.now());
      // نفس لحظة بداية المؤقت: السيرفر يسجّل ساعته هو.
      if (serverTracking) {
        startPromiseRef.current = startRiddleOnServer(riddleNumber - 1);
      }
    }
  }, [isTypingComplete, startTime, serverTracking, riddleNumber]);

  // لو المستخدم خرج من الشاشة فجأة (زر الرجوع للرئيسية مثلًا)، لازم
  // موسيقى وقت التفكير توقف ومتفضلش شغالة في الخلفية.
  useEffect(() => {
    return () => {
      stopMusic();
    };
  }, [stopMusic]);

  // Show banner on puzzle screen; hide when leaving. لو المستخدم اشترى
  // "إلغاء الإعلانات" ميتعرضش أي بانر إطلاقًا لحسابه. وكمان بنقفله
  // فورًا وقت ظهور شاشة العرض (bannerSuppressed) ونرجّعه تلقائي بعد
  // ما تقفل — عشان مفيش إعلان (بانر أو فاصل) يظهر في نفس وقتها.
  useEffect(() => {
    if (purchasedNoAds || bannerSuppressed) {
      void hideBannerAd();
      return;
    }
    void showBannerAd();
    return () => {
      void hideBannerAd();
    };
  }, [purchasedNoAds, bannerSuppressed]);

  // السيرفر هو اللي بيقول أنهي إجابتين غلط يتشطبوا.
  const applyFifty = async (): Promise<boolean> => {
    if (!serverTracking) {
      alert("سجّل الدخول عشان تقدر تستخدم المساعدة.");
      return false;
    }
    try {
      await startPromiseRef.current;
    } catch {
      /* تجاهل */
    }
    const removeTexts = await fiftyOnServer(riddleNumber - 1, riddle.options);
    if (!removeTexts) {
      alert("تعذّر حذف الإجابتين الآن، حاول مرة أخرى.");
      return false;
    }
    const toRemove = riddle.options
      .map((o, i) => (removeTexts.includes(o) ? i : -1))
      .filter((i) => i >= 0);
    setRemovedOptions(toRemove);
    setLifelineUsed("fifty");
    if (selectedOption !== null && toRemove.includes(selectedOption)) {
      setSelectedOption(null);
    }
    return true;
  };

  const handleUseFifty = async () => {
    if (lifelineUsed || showResult) return;

    // اشترى "فتح ميزة المكافأة" → الأداة تتفعّل فورًا من غير ما يشوف
    // أي إعلان مكافأة.
    if (purchasedRewardUnlock) {
      await applyFifty();
      return;
    }

    const before = Date.now();

    const earned = await showRewarded({
      onStart: () => setAdPaused(true),
      onEnd: () => setAdPaused(false),
    });

    console.log("[Rewarded] earned =", earned);

    if (startTime !== null) {
      setStartTime(startTime + (Date.now() - before));
    }

    if (!earned) {
      console.error("[Rewarded] Failed to show rewarded ad.");
      alert("تعذر عرض الإعلان حاليًا، حاول مرة أخرى بعد قليل.");
      return;
    }

    await applyFifty();
  };

  const handleAddTime = async () => {
    if (lifelineUsed || showResult) return;

    if (purchasedRewardUnlock) {
      setExtraTime((p) => p + 60);
      setLifelineUsed("time");
      return;
    }

    const before = Date.now();

    const earned = await showRewarded({
      onStart: () => setAdPaused(true),
      onEnd: () => setAdPaused(false),
    });

    console.log("[Rewarded] earned =", earned);

    if (startTime !== null) {
      setStartTime(startTime + (Date.now() - before));
    }

    if (!earned) {
      console.error("[Rewarded] Failed to show rewarded ad.");
      alert("تعذر عرض الإعلان حاليًا، حاول مرة أخرى بعد قليل.");
      return;
    }

    setExtraTime((p) => p + 60);
    setLifelineUsed("time");
  };

  // وقف الساعة (على الشاشة) طول ما المساعدة شغالة، وبعدها نرجّع الوقت اللي ضاع.
  const handleHelpBusy = (busy: boolean) => {
    setHelpBusy(busy);
    if (busy) {
      helpStartRef.current = Date.now();
    } else if (helpStartRef.current !== null) {
      const lost = Date.now() - helpStartRef.current;
      helpStartRef.current = null;
      setStartTime((t) => (t === null ? t : t + lost));
    }
  };

  const normalizeText = (t: string) => t.normalize("NFC").trim();
  const hintIndex =
    hintText === null ? -1 : riddle.options.findIndex((o) => normalizeText(o) === normalizeText(hintText));

  const handleTimeUp = () => {
    if (!showResult && selectedOption === null) {
      setShowResult(true);
      stopMusic();
      playSound("wrong");
      onAnswer(false, null);

      autoNextTimerRef.current = setTimeout(() => goNext(), 1800);
    }
  };

  const handleOptionClick = (index: number) => {
    if (showResult || !isTypingComplete || paused || submitting) return;
    setSelectedOption(index);
  };

  const handleSubmit = async () => {
    if (selectedOption === null || paused || submitting || showResult) return;
    if (!serverTracking) {
      setSubmitError("سجّل الدخول عشان تقدر تجاوب.");
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    // موسيقى التفكير تقف فورًا لحظة "تحقق من الإجابة".
    stopMusic();

    const chosenIndex = selectedOption;
    const chosenText = riddle.options[chosenIndex];
    const elapsedMs = startTime ? Date.now() - startTime : null;

    // بنستنى تسجيل بداية اللغز الأول عشان الترتيب يبقى سليم.
    try {
      await startPromiseRef.current;
    } catch {
      /* تجاهل */
    }

    // السيرفر بيصحّح ويحسب الزمن بساعته ويسجّل للترتيب الأسبوعي.
    const outcome = await submitAnswerToServer(riddleNumber - 1, chosenText);
    setSubmitting(false);

    if (outcome.status === "ok") {
      const res = outcome.result;
      setServerCorrect(res.isCorrect);
      setServerExplanation(res.explanation);
      setShowResult(true);
      playSound(res.isCorrect ? "correct" : "wrong");

      onAnswer(res.isCorrect, chosenIndex, undefined, elapsedMs);
      onServerResult?.(res);

      if (!res.isCorrect) {
        autoNextTimerRef.current = setTimeout(() => goNext(), 1800);
      }
    } else if (outcome.status === "conflict") {
      // اتسجّلت قبل كده (الرد الأول ضاع): نكمّل من غير ما نعرض صح/غلط.
      setServerCorrect(null);
      setShowResult(true);
    } else {
      setSubmitError("تعذّر الاتصال بالسيرفر. اتأكد من النت وجرّب تاني.");
    }
  };

  return (
    <div
      className="w-full max-w-4xl mx-auto px-4 relative"
      style={{
        backgroundImage: `linear-gradient(rgba(0,0,0,0.78), rgba(0,0,0,0.85)), url(${moneyBg})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
        backgroundRepeat: "no-repeat",
        borderRadius: "1rem",
        padding: "1.5rem",
        paddingBottom: "calc(1.5rem + 72px)",
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center gap-4 mb-8"
      >
        <HorrorClock
          key={riddleNumber}
          duration={60}
          isActive={isTypingComplete && !showResult}
          paused={adPaused || helpBusy || paused}
          onTimeUp={handleTimeUp}
          isMuted={isMuted}
          extraTime={extraTime}
        />

        {gameMode === "fun" && (
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={handleUseFifty}
              disabled={lifelineUsed !== null || showResult || !isTypingComplete}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary border border-primary/40 text-primary text-sm font-typewriter hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              aria-label="حذف إجابتين خاطئتين"
            >
              <Scissors className="w-4 h-4" />
              <span>{purchasedRewardUnlock ? "حذف إجابتين" : "شاهد الإعلان لحذف إجابتين"}</span>
            </button>
            <button
              type="button"
              onClick={handleAddTime}
              disabled={lifelineUsed !== null || showResult || !isTypingComplete}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary border border-primary/40 text-primary text-sm font-typewriter hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              aria-label="إضافة دقيقة"
            >
              <Clock className="w-4 h-4" />
              <span>{purchasedRewardUnlock ? "إضافة دقيقة" : "شاهد الإعلان لإضافة دقيقة"}</span>
            </button>
          </div>
        )}
        {gameMode === "fun" && serverTracking && userId && (
          <HelpFriend
            userId={userId}
            riddleIndex={riddleNumber - 1}
            disabled={showResult || !isTypingComplete || paused || submitting}
            skipAd={purchasedRewardUnlock || helpPassTier > 0}
            extendSkipAd={purchasedRewardUnlock}
            onHint={setHintText}
            onBusyChange={handleHelpBusy}
            onAdStart={() => setAdPaused(true)}
            onAdEnd={() => setAdPaused(false)}
          />
        )}
        {lifelineUsed && (
          <p className="text-xs text-muted-foreground font-typewriter">
            تم استخدام أداة المساعدة لهذا السؤال
          </p>
        )}

        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-3">
            <Brain className="w-8 h-8 text-primary" />
            <span className="font-horror text-2xl text-primary">اللغز {riddleNumber} / {totalRiddles}</span>
          </div>

          <button
            type="button"
            onClick={handleMuteToggle}
            className="p-2 rounded-full bg-secondary hover:bg-accent transition-colors cursor-pointer z-50"
            aria-label={isMuted ? "تشغيل الصوت" : "كتم الصوت"}
          >
            {isMuted ? (
              <MicOff className="w-6 h-6 text-muted-foreground" />
            ) : (
              <Mic className="w-6 h-6 text-primary" />
            )}
          </button>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="image-horror mb-8 relative"
      >
        <video
          ref={videoRef}
          src={riddleCompetitionVideo}
          className="w-full max-h-80 object-cover"
          autoPlay
          loop
          muted={videoMuted}
          playsInline
        />
        <button
          type="button"
          onClick={handleVideoMuteToggle}
          className="absolute top-2 left-2 p-2 rounded-full bg-black/60 hover:bg-black/80 transition-colors z-10"
          aria-label={videoMuted ? "تشغيل صوت الفيديو" : "كتم صوت الفيديو"}
        >
          {videoMuted ? (
            <VolumeX className="w-5 h-5 text-white" />
          ) : (
            <Volume2 className="w-5 h-5 text-white" />
          )}
        </button>
      </motion.div>

      <div className="card-horror p-6 mb-8 min-h-[120px]">
        <TypewriterText
          text={riddle.question}
          speed={40}
          className="text-xl md:text-2xl leading-relaxed text-right"
          onComplete={() => {
            setIsTypingComplete(true);
            // موسيقى وقت التفكير تبدأ فورًا بعد ما ينتهي صوت كتابة اللغز.
            startMusic();
          }}
          onCharacterTyped={() => playSound("typewriter")}
          paused={paused}
        />
      </div>

      <AnimatePresence>
        {isTypingComplete && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4 mb-8"
          >
            <p className="text-center text-amber-400 font-typewriter text-sm md:text-base leading-relaxed">
              🏆 الفائز بالجائزة الأسبوعية هو صاحب أسرع إجابة صحيحة!
            </p>
            {riddle.options.map((option, index) => {
              const isRemoved = removedOptions.includes(index);
              if (isRemoved) {
                return (
                  <div
                    key={index}
                    className="option-horror w-full text-right flex items-center gap-4 opacity-30 line-through pointer-events-none"
                  >
                    <span className="w-10 h-10 rounded-full bg-muted flex items-center justify-center font-horror text-muted-foreground text-xl shrink-0">
                      ✕
                    </span>
                    <span className="font-typewriter text-muted-foreground text-lg leading-relaxed">
                      {option}
                    </span>
                  </div>
                );
              }
              return (
                <div key={index} className="relative">
                  {hintIndex === index && !showResult && (
                    <span className="absolute -top-2 left-3 z-10 rounded-full bg-emerald-500 px-2 py-0.5 text-xs font-typewriter text-black shadow">
                      💡 صديقك بيرشّح دي
                    </span>
                  )}
                <RiddleOption
                  option={option}
                  index={index}
                  selected={selectedOption === index}
                  showResult={showResult}
                  isCorrect={serverCorrect === true && selectedOption === index}
                  onClick={() => handleOptionClick(index)}
                  disabled={showResult}
                  hideCorrectInCompetition={false}
                />
                </div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showResult && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="card-horror p-6 mb-8 text-right"
          >
            {serverCorrect === true ? (
              <>
                <h3 className="font-horror text-2xl mb-3 text-primary">🎉 أحسنت!</h3>
                {serverExplanation && (
                  <p className="font-typewriter text-foreground text-lg leading-relaxed">
                    {serverExplanation}
                  </p>
                )}
              </>
            ) : serverCorrect === false ? (
              <h3 className="font-horror text-2xl text-primary">🍀 حظ أوفر في المرة القادمة</h3>
            ) : (
              <h3 className="font-horror text-2xl text-primary">تم تسجيل إجابتك ✅</h3>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {submitError && (
        <p className="text-center text-red-400 font-typewriter text-sm mb-4">{submitError}</p>
      )}

      <div className="flex justify-center gap-4">
        {!showResult ? (
          <HorrorButton
            onClick={handleSubmit}
            disabled={selectedOption === null || !isTypingComplete || submitting}
          >
            {submitting ? "جاري التحقق..." : "تحقق من الإجابة"}
          </HorrorButton>
        ) : (
          <HorrorButton onClick={goNext}>
            {riddleNumber < totalRiddles ? "اللغز التالي" : "النتيجة النهائية"}
          </HorrorButton>
        )}
      </div>

      {onExitToHome && (
        <div className="flex justify-center mt-6 mb-8">
          <button
            type="button"
            onClick={onExitToHome}
            className="px-5 py-2 rounded-lg border border-primary/40 bg-secondary/60 text-primary font-typewriter text-sm hover:bg-accent transition-colors"
          >
            🏠 العودة إلى القائمة الرئيسية
          </button>
        </div>
      )}
    </div>
  );
};

export default RiddleCard;
