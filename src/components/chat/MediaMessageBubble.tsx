import { useEffect, useRef, useState } from "react";
import { Play, Pause, AlertTriangle, Loader2, Eye, EyeOff } from "lucide-react";
import { downloadAndDecrypt, ackMediaViewed, markViewOnceOpened } from "@/lib/chat/mediaUpload";

interface Props {
  messageId: string;
  kind: "dm" | "group";
  mediaType: "image" | "audio" | "video";
  mediaPath: string | null;
  mediaMime: string | null;
  mediaIv: string | null;
  mediaKey: string | null;
  mediaDeletedAt: string | null;
  durationSeconds?: number | null;
  mine: boolean;
  viewOnce?: boolean;
  viewedAt?: string | null;
}

export default function MediaMessageBubble({
  messageId,
  kind,
  mediaType,
  mediaPath,
  mediaMime,
  mediaIv,
  mediaKey,
  mediaDeletedAt,
  durationSeconds,
  mine,
  viewOnce,
  viewedAt,
}: Props) {
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "expired" | "error">("idle");
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [consumedByOther, setConsumedByOther] = useState(!mine && !!viewOnce && !!viewedAt);
  const [revealed, setRevealed] = useState(false);
  const ackedRef = useRef(false);

  const expired = !!mediaDeletedAt || !mediaPath || !mediaIv || !mediaKey;
  // في رسائل View Once: المستقبل لازم يضغط عشان يشوفها (مفيش تحميل تلقائي)،
  // وبعد ما يقفلها منعرضهاش تاني — نفس سلوك واتساب بالظبط.
  const isViewOnceForMe = !!viewOnce && !mine;

  useEffect(() => {
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [objectUrl]);

  const load = async () => {
    if (expired || status === "loading" || status === "ready") return;
    setStatus("loading");
    try {
      const blob = await downloadAndDecrypt(mediaPath!, mediaIv!, mediaKey!, mediaMime || "application/octet-stream");
      const url = URL.createObjectURL(blob);
      setObjectUrl(url);
      setStatus("ready");
      // أول ما المستقبل (مش المرسل) يفتح الوسائط فعليًا، نأكّد الاستلام
      // عشان تتمسح فورًا من التخزين المؤقت بدل ما تستنى 72 ساعة
      if (!mine && !ackedRef.current) {
        ackedRef.current = true;
        void ackMediaViewed(messageId, kind);
      }
    } catch {
      setStatus("error");
    }
  };

  // فتح رسالة View Once: أول حاجة نتأكد إن حد تاني ما استهلكهاش قبل كده،
  // وبعدين نكشفها ونحمّلها. لو فيها استهلاك سابق نوقف فورًا.
  const openViewOnce = async () => {
    if (status === "loading" || revealed) return;
    setStatus("loading");
    try {
      const allowed = await markViewOnceOpened(messageId, kind);
      if (!allowed) {
        setConsumedByOther(true);
        setStatus("idle");
        return;
      }
      setRevealed(true);
      await load();
    } catch {
      setStatus("error");
    }
  };

  // الصور بنحملها تلقائيًا أول ما الفقاعة تظهر (زي واتساب)، أما الصوت
  // والفيديو فبنستنى ضغطة تشغيل عشان نوفر استهلاك بيانات المستخدم.
  // استثناء: رسائل View Once ما بتتحملش تلقائيًا أبدًا — لازم ضغطة كشف صريحة.
  useEffect(() => {
    if (mediaType === "image" && !expired && !isViewOnceForMe) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediaPath]);

  if (expired) {
    return (
      <div className="flex items-center gap-2 text-white/60 text-xs italic bg-black/10 rounded-lg px-3 py-2">
        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
        انتهت صلاحية هذه الوسائط
      </div>
    );
  }

  // المرسل نفسه ما بيستهلكش عرضة الـ View Once، لكن بنوريله شارة كده عشان
  // يعرف حالتها (اتشافت ولا لسه)
  if (viewOnce && mine) {
    return (
      <div className="flex items-center gap-2 text-white/70 text-xs bg-black/10 rounded-lg px-3 py-2">
        {viewedAt ? <EyeOff className="w-3.5 h-3.5 shrink-0" /> : <Eye className="w-3.5 h-3.5 shrink-0" />}
        {viewedAt ? "تم استعراضها — رسالة تشاهَد مرة واحدة" : "بانتظار المشاهدة — رسالة تشاهَد مرة واحدة"}
      </div>
    );
  }

  if (isViewOnceForMe && (consumedByOther || (viewedAt && !revealed))) {
    return (
      <div className="flex items-center gap-2 text-white/60 text-xs italic bg-black/10 rounded-lg px-3 py-2">
        <EyeOff className="w-3.5 h-3.5 shrink-0" />
        تم استعراض هذه الرسالة بالفعل
      </div>
    );
  }

  if (isViewOnceForMe && !revealed) {
    return (
      <button
        onClick={openViewOnce}
        disabled={status === "loading"}
        className="flex items-center gap-2 w-40 h-24 rounded-lg bg-black/30 justify-center text-white/80"
      >
        {status === "loading" ? <Loader2 className="w-6 h-6 animate-spin" /> : <Eye className="w-6 h-6" />}
        <span className="text-[11px]">اضغط للمشاهدة مرة واحدة</span>
      </button>
    );
  }

  if (mediaType === "image") {
    if (status === "loading" || status === "idle") {
      return (
        <div className="w-48 h-48 rounded-lg bg-black/20 flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-white/60" />
        </div>
      );
    }
    if (status === "error") {
      return (
        <div className="flex items-center gap-2 text-white/60 text-xs italic bg-black/10 rounded-lg px-3 py-2">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          تعذر عرض الصورة
        </div>
      );
    }
    return (
      <img
        src={objectUrl!}
        alt="صورة مرسلة"
        className="max-w-[240px] max-h-[320px] rounded-lg object-cover"
        loading="lazy"
      />
    );
  }

  if (mediaType === "video") {
    if (status !== "ready") {
      return (
        <button
          onClick={load}
          disabled={status === "loading"}
          className="w-48 h-32 rounded-lg bg-black/30 flex items-center justify-center text-white/80"
        >
          {status === "loading" ? <Loader2 className="w-6 h-6 animate-spin" /> : <Play className="w-8 h-8" />}
        </button>
      );
    }
    return <video src={objectUrl!} controls className="max-w-[260px] max-h-[320px] rounded-lg" />;
  }

  // audio
  return <AudioBubble status={status} objectUrl={objectUrl} durationSeconds={durationSeconds} onLoad={load} />;
}

function AudioBubble({
  status,
  objectUrl,
  durationSeconds,
  onLoad,
}: {
  status: string;
  objectUrl: string | null;
  durationSeconds?: number | null;
  onLoad: () => void;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);

  const toggle = async () => {
    if (status !== "ready") {
      onLoad();
      return;
    }
    const el = audioRef.current;
    if (!el) return;
    if (playing) {
      el.pause();
    } else {
      void el.play();
    }
  };

  const mm = Math.floor((durationSeconds ?? 0) / 60);
  const ss = Math.floor((durationSeconds ?? 0) % 60)
    .toString()
    .padStart(2, "0");

  return (
    <div className="flex items-center gap-2 min-w-[160px]">
      <button
        onClick={toggle}
        className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center shrink-0"
        aria-label={playing ? "إيقاف" : "تشغيل"}
      >
        {status === "loading" ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : playing ? (
          <Pause className="w-4 h-4" />
        ) : (
          <Play className="w-4 h-4" />
        )}
      </button>
      <div className="flex-1 h-1 rounded-full bg-white/20" />
      <span className="text-[10px] text-white/70 shrink-0">
        {mm}:{ss}
      </span>
      {objectUrl && (
        <audio
          ref={audioRef}
          src={objectUrl}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
          className="hidden"
        />
      )}
    </div>
  );
}
