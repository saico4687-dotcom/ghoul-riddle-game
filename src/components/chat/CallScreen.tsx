// شاشة المكالمة الكاملة — بتغطي أي مكان في قسم الدردشة لما فيه مكالمة
// شغالة (واردة/صادرة/متصلة)، وبتختفي تلقائيًا لما phase ترجع idle/ended.
//
// - "incoming": شاشة رنين واردة (اسم/صورة المتصل + رفض/قبول)
// - "outgoing": شاشة اتصال صادر (جاري الاتصال... + إلغاء)
// - "connected": شاشة أثناء المكالمة (عداد المدة، كتم، سماعة، كاميرا لو فيديو، إنهاء)
//
// السيرفر (Supabase) بيُستخدم فقط لإشارة WebRTC — الصوت/الفيديو بث مباشر
// P2P من غير أي تسجيل أو تخزين. راجع src/hooks/useCall.ts.
import { useEffect, useRef, useState } from "react";
import { Phone, PhoneOff, Mic, MicOff, Volume2, VolumeX, Video, VideoOff, RefreshCw } from "lucide-react";
import { useCallContext } from "@/hooks/useCallContext";
import { fetchPublicProfile, type PublicProfile } from "@/lib/chat/queries";
import UserAvatar from "@/components/chat/UserAvatar";
import { cn } from "@/lib/utils";

/** بيرن نغمة رنين بسيطة بتتكرر (نغمتين متبادلين) طول ما المكالمة "واردة" — بدون أي ملف صوتي خارجي. */
function useRingtone(active: boolean) {
  const ctxRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!active) return;

    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx: AudioContext = new AudioCtx();
    ctxRef.current = ctx;

    const ring = () => {
      if (ctx.state === "closed") return;
      const now = ctx.currentTime;
      [0, 0.35].forEach((offset) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = 480;
        gain.gain.setValueAtTime(0, now + offset);
        gain.gain.linearRampToValueAtTime(0.18, now + offset + 0.05);
        gain.gain.linearRampToValueAtTime(0, now + offset + 0.3);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + offset);
        osc.stop(now + offset + 0.32);
      });
    };

    ring();
    timerRef.current = window.setInterval(ring, 1600);

    // اهتزاز على الموبايل لو مدعوم (Web Vibration API)
    if (navigator.vibrate) {
      navigator.vibrate([400, 200, 400, 200, 400]);
    }

    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      timerRef.current = null;
      navigator.vibrate?.(0);
      ctx.close().catch(() => {});
      ctxRef.current = null;
    };
  }, [active]);
}

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export default function CallScreen() {
  const {
    phase,
    peerId,
    kind,
    localStream,
    remoteStream,
    muted,
    cameraOff,
    reconnecting,
    error,
    acceptCall,
    declineCall,
    hangUp,
    toggleMute,
    toggleCamera,
    switchCamera,
  } = useCallContext();

  const [peer, setPeer] = useState<PublicProfile | null>(null);
  const [speakerOn, setSpeakerOn] = useState(true);
  const [elapsed, setElapsed] = useState(0);

  // ref واحد بيتشارك بين عنصر <video> (فيديو متصل) وعنصر <audio> (باقي
  // الحالات) — النوع HTMLMediaElement عشان يستوعب الاتنين بأمان بدون any.
  const remoteMediaRef = useRef<HTMLMediaElement | null>(null);
  const setRemoteVideoEl = (el: HTMLVideoElement | null) => {
    remoteMediaRef.current = el;
  };
  const setRemoteAudioEl = (el: HTMLAudioElement | null) => {
    remoteMediaRef.current = el;
  };
  const localVideoRef = useRef<HTMLVideoElement | null>(null);

  const visible = phase === "incoming" || phase === "outgoing" || phase === "connected";
  const isVideo = kind === "video";

  useRingtone(phase === "incoming");

  // نجيب بروفايل الطرف التاني (اسم/صورة) كل ما اتغيّر
  useEffect(() => {
    if (!peerId) {
      setPeer(null);
      return;
    }
    let cancelled = false;
    fetchPublicProfile(peerId).then((p) => {
      if (!cancelled) setPeer(p);
    });
    return () => {
      cancelled = true;
    };
  }, [peerId]);

  // عداد مدة المكالمة — يبدأ من لحظة الاتصال الفعلي
  useEffect(() => {
    if (phase !== "connected") {
      setElapsed(0);
      return;
    }
    const start = Date.now();
    const t = window.setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 500);
    return () => window.clearInterval(t);
  }, [phase]);

  // تشغيل صوت/فيديو الطرف التاني فعليًا. بنعيد تطبيق الـ srcObject كل ما
  // الـ stream نفسه يتغيّر، أو كل ما العنصر المعروض يتبدّل بين <audio>
  // و<video> (لما المكالمة توصل "connected" في مكالمة فيديو) — عشان لو
  // الـ track وصل قبل ما نتحول لعنصر الفيديو، الصوت/الفيديو يفضل شغال.
  useEffect(() => {
    const el = remoteMediaRef.current;
    if (!el) return;
    el.srcObject = remoteStream ?? null;
    if (remoteStream) el.play().catch(() => {});
  }, [remoteStream, phase, isVideo]);

  // معاينة الكاميرا المحلية (Picture-in-Picture) في مكالمات الفيديو
  useEffect(() => {
    const el = localVideoRef.current;
    if (!el) return;
    el.srcObject = localStream ?? null;
    if (localStream) el.play().catch(() => {});
  }, [localStream]);

  // زر السماعة: بيحاول يبدّل مخرج الصوت (setSinkId) لو المتصفح بيدعمه —
  // مدعوم في متصفحات ديسكتوب معيّنة بس، وده متوافق مع سلوك واتساب ويب
  // اللي بيوريه الزرار برضه حتى لو مفيش تبديل فعلي للسماعة/الأذن الممكن.
  const handleToggleSpeaker = async () => {
    const next = !speakerOn;
    setSpeakerOn(next);
    const el = remoteMediaRef.current as (HTMLMediaElement & { setSinkId?: (id: string) => Promise<void> }) | null;
    if (el?.setSinkId) {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const target = devices.find((d) =>
          next ? d.kind === "audiooutput" && /speaker/i.test(d.label) : d.kind === "audiooutput" && /earpiece|receiver/i.test(d.label)
        );
        if (target) await el.setSinkId(target.deviceId);
      } catch {
        // مفيش دعم أو مفيش صلاحية — الزرار بيفضل شغال بصريًا زي واتساب ويب
      }
    }
  };

  if (!visible) return null;

  const displayName = peer?.username ?? "مستخدم";

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-between bg-black/70 backdrop-blur-xl text-white" dir="rtl">
      {/* فيديو الطرف التاني كامل الخلفية لما يكون فيديو ومتصل */}
      {isVideo && phase === "connected" && remoteStream ? (
        <video ref={setRemoteVideoEl} autoPlay playsInline className="absolute inset-0 w-full h-full object-cover" />
      ) : (
        <audio ref={setRemoteAudioEl} autoPlay />
      )}

      {/* تعتيم فوق الفيديو عشان النصوص/الأزرار تفضل واضحة */}
      {isVideo && phase === "connected" && remoteStream && <div className="absolute inset-0 bg-black/40" />}

      {/* معاينة الكاميرا المحلية (PiP) + زر تبديل الكاميرا الأمامية/الخلفية */}
      {isVideo && localStream && !cameraOff && (
        <div className="absolute top-16 left-4 z-10">
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            className="w-24 h-32 rounded-2xl object-cover border-2 border-white/30 shadow-lg"
          />
          {phase === "connected" && (
            <button
              onClick={() => switchCamera()}
              aria-label="تبديل الكاميرا"
              title="تبديل الكاميرا"
              className="absolute -bottom-2 -left-2 w-8 h-8 rounded-full bg-black/60 border border-white/30 flex items-center justify-center"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {/* الجزء العلوي: صورة/اسم المتصل + الحالة */}
      <div className="relative z-[1] flex flex-col items-center gap-3 pt-16 px-6">
        <UserAvatar url={peer?.avatar_url} username={peer?.username} size="xl" />
        <div className="font-horror text-2xl">{displayName}</div>
        <div className="text-white/70 font-typewriter text-sm">
          {phase === "incoming" && (isVideo ? "مكالمة فيديو واردة…" : "مكالمة صوتية واردة…")}
          {phase === "outgoing" && "جاري الاتصال…"}
          {phase === "connected" && !reconnecting && formatDuration(elapsed)}
          {phase === "connected" && reconnecting && (
            <span className="flex items-center gap-1.5 text-amber-300">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-300 animate-pulse" />
              جاري إعادة الاتصال…
            </span>
          )}
        </div>
        {error && <div className="text-destructive text-xs font-typewriter mt-1">{error}</div>}
      </div>

      {/* نبضة رنين بصرية حوالين الصورة أثناء الرنين */}
      {(phase === "incoming" || phase === "outgoing") && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 w-24 h-24 rounded-full border-2 border-white/40 animate-ping" />
      )}

      {/* الجزء السفلي: أزرار التحكم */}
      <div className="relative z-[1] w-full pb-12 px-8">
        {phase === "incoming" && (
          <div className="flex items-center justify-center gap-16">
            <CallButton onClick={declineCall} color="bg-destructive" label="رفض">
              <PhoneOff className="w-7 h-7" />
            </CallButton>
            <CallButton onClick={acceptCall} color="bg-emerald-500" label="قبول">
              <Phone className="w-7 h-7" />
            </CallButton>
          </div>
        )}

        {phase === "outgoing" && (
          <div className="flex items-center justify-center">
            <CallButton onClick={hangUp} color="bg-destructive" label="إلغاء">
              <PhoneOff className="w-7 h-7" />
            </CallButton>
          </div>
        )}

        {phase === "connected" && (
          <div className="flex items-center justify-center gap-6">
            <CallButton onClick={toggleMute} color={muted ? "bg-white/90" : "bg-white/15"} label={muted ? "إلغاء الكتم" : "كتم"}>
              {muted ? <MicOff className="w-6 h-6 text-black" /> : <Mic className="w-6 h-6" />}
            </CallButton>
            <CallButton onClick={handleToggleSpeaker} color={speakerOn ? "bg-white/90" : "bg-white/15"} label="السماعة">
              {speakerOn ? <Volume2 className="w-6 h-6 text-black" /> : <VolumeX className="w-6 h-6" />}
            </CallButton>
            {isVideo && (
              <CallButton onClick={toggleCamera} color={cameraOff ? "bg-white/90" : "bg-white/15"} label={cameraOff ? "تشغيل الكاميرا" : "إيقاف الكاميرا"}>
                {cameraOff ? <VideoOff className="w-6 h-6 text-black" /> : <Video className="w-6 h-6" />}
              </CallButton>
            )}
            <CallButton onClick={hangUp} color="bg-destructive" label="إنهاء">
              <PhoneOff className="w-6 h-6" />
            </CallButton>
          </div>
        )}
      </div>
    </div>
  );
}

function CallButton({
  onClick,
  color,
  label,
  children,
}: {
  onClick: () => void;
  color: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <button
        onClick={onClick}
        className={cn("w-16 h-16 rounded-full flex items-center justify-center shadow-lg transition-transform active:scale-95", color)}
        aria-label={label}
      >
        {children}
      </button>
      <span className="text-[11px] text-white/70 font-typewriter">{label}</span>
    </div>
  );
}
