import { useEffect, useRef, useState } from "react";
import { Play, Pause, AlertTriangle, Loader2 } from "lucide-react";
import { downloadAndDecrypt, ackMediaViewed } from "@/lib/chat/mediaUpload";

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
}: Props) {
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "expired" | "error">("idle");
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const ackedRef = useRef(false);

  const expired = !!mediaDeletedAt || !mediaPath || !mediaIv || !mediaKey;

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

  // الصور بنحملها تلقائيًا أول ما الفقاعة تظهر (زي واتساب)، أما الصوت
  // والفيديو فبنستنى ضغطة تشغيل عشان نوفر استهلاك بيانات المستخدم
  useEffect(() => {
    if (mediaType === "image" && !expired) void load();
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
