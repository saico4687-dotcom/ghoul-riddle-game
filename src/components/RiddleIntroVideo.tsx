import { useEffect, useRef } from "react";
import { getRiddleVideoUrl, hasRiddleVideo, RIDDLE_INTRO_MS } from "@/lib/riddleVideos";

interface Props {
  riddleNumber: number;
  totalRiddles: number;
  // بيتنادى مرة واحدة لما الفيديو يخلص (أو يفشل تحميله) عشان اللغز يبدأ.
  onDone: () => void;
  // true لو اللعبة في الخلفية/فيه إعلان — بنوقف الفيديو لحد ما نرجع.
  paused?: boolean;
}

// أقصى وقت ننتظره لبدء تشغيل الفيديو قبل ما نتخطاه (شبكة بطيئة أو ملف ناقص).
const START_TIMEOUT_MS = 6000;

const RiddleIntroVideo = ({ riddleNumber, totalRiddles, onDone, paused = false }: Props) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const doneRef = useRef(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  const finish = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    onDoneRef.current();
  };

  // تشغيل الفيديو: نجرّب بصوت، ولو المتصفح منع نشغّله كتم.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = false;
    v.play().catch(() => {
      v.muted = true;
      v.play().catch(() => {});
    });
  }, [riddleNumber]);

  // لو الفيديو ملوش بداية تشغيل (404 / شبكة) نكمل اللغز بدل ما اللعبة تعلق.
  useEffect(() => {
    const t = setTimeout(() => {
      const v = videoRef.current;
      if (!v || v.readyState < 2) finish();
    }, START_TIMEOUT_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [riddleNumber]);

  // سقف أمان: مهما كان طول الملف، مانزيدش عن 4 ثواني (من أول تشغيل فعلي).
  const capTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (capTimerRef.current) clearTimeout(capTimerRef.current);
  }, []);

  // إيقاف/استئناف مع الإعلانات أو الخروج للخلفية.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (paused) v.pause();
    else if (v.paused && !v.ended) void v.play().catch(() => {});
  }, [paused]);

  // تحميل مسبق للفيديو التالي عشان مايبقاش فيه تأخير.
  useEffect(() => {
    if (riddleNumber >= totalRiddles || !hasRiddleVideo(riddleNumber + 1)) return;
    const pre = document.createElement("video");
    pre.preload = "auto";
    pre.muted = true;
    pre.src = getRiddleVideoUrl(riddleNumber + 1);
    return () => {
      pre.removeAttribute("src");
      pre.load();
    };
  }, [riddleNumber, totalRiddles]);

  return (
    <div
      className="fixed inset-0 z-[9997] bg-black flex items-center justify-center"
      dir="rtl"
      role="dialog"
      aria-label={`فيديو اللغز ${riddleNumber}`}
    >
      <video
        key={riddleNumber}
        ref={videoRef}
        src={getRiddleVideoUrl(riddleNumber)}
        className="w-full h-full object-contain"
        autoPlay
        playsInline
        preload="auto"
        onPlaying={() => {
          if (!capTimerRef.current) {
            capTimerRef.current = setTimeout(finish, RIDDLE_INTRO_MS + 300);
          }
        }}
        onEnded={finish}
        onError={finish}
      />
      <span className="absolute top-4 left-1/2 -translate-x-1/2 text-primary/80 font-typewriter text-sm">
        اللغز {riddleNumber} / {totalRiddles}
      </span>
    </div>
  );
};

export default RiddleIntroVideo;
