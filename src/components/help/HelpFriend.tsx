import { useCallback, useEffect, useRef, useState } from "react";
import { Phone, X } from "lucide-react";
import { toast } from "sonner";
import UserAvatar from "@/components/chat/UserAvatar";
import HelpVoiceBar from "./HelpVoiceBar";
import AddFriendButton from "./AddFriendButton";
import { useHelpVoice } from "@/hooks/useHelpVoice";
import { helpApi, helpErrorMessage, helpRuntime, type HelpKind, type HelpPerson } from "@/lib/helpApi";
import { showRewarded } from "@/lib/adsMediation";

// زر "استعن بصديق" + كل مراحله عند اللاعب الطالب:
// نوعين: 🎙 صوت (إعلان في كل مرة، 5 يوميًا) و 💡 تلميح بدون صوت (إعلان لكل 5 تلميحات).
// فحص المساعدين → إعلان مكافأة (إلا لو مشتري فتح المكافآت أو معاه فرصة مجانية) →
// انتظار القبول → (صوت: عدّاد بعد ما المايك يتوصل عند الاتنين) → تلميح + كارت "تمت مساعدتك".

type Phase = "idle" | "checking" | "waiting" | "connected" | "expired" | "done";

interface Props {
  userId: string;
  riddleIndex: number; // 0-based
  disabled: boolean;
  skipAd: boolean; // باقة خط النجدة أو فتح المكافآت: المساعدة من غير إعلان
  extendSkipAd: boolean; // فتح المكافآت: إضافة الدقيقة من غير إعلان
  // بتتنادى بنص الخيار اللي المساعد اختاره (للتلميح) + الخيار الغلط اللي المساعد كان اختاره قبل كده (لو جاوب غلط).
  onHint: (optionText: string, wrongOptionText?: string | null) => void;
  // true طول ما المساعدة شغالة (الساعة بتتوقف).
  onBusyChange: (busy: boolean) => void;
  // إعلان المكافأة: نفس آلية الأدوات التانية (وقف الساعة أثناء الإعلان).
  onAdStart: () => void;
  onAdEnd: () => void;
}

export default function HelpFriend({ userId, riddleIndex, disabled, skipAd, extendSkipAd, onHint, onBusyChange, onAdStart, onAdEnd }: Props) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [reqId, setReqId] = useState<string | null>(null);
  const [key, setKey] = useState<string | null>(null);
  const [other, setOther] = useState<HelpPerson | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(60);
  const [kind, setKind] = useState<HelpKind>("voice");
  const [retryKind, setRetryKind] = useState<HelpKind | null>(null);
  const [voiceStarted, setVoiceStarted] = useState(false);
  const [used, setUsed] = useState(false);
  const [talkEndsAt, setTalkEndsAt] = useState(0);
  const [canExtend, setCanExtend] = useState(false);
  const [extending, setExtending] = useState(false);
  const [now, setNow] = useState(Date.now());
  const expiresRef = useRef<number>(0);
  const phaseRef = useRef<Phase>("idle");
  phaseRef.current = phase;
  const kindRef = useRef<HelpKind>("voice");
  kindRef.current = kind;

  const busy = phase === "checking" || phase === "waiting" || phase === "connected";
  useEffect(() => {
    onBusyChange(phase === "waiting" || phase === "connected");
    helpRuntime.askerActive = phase === "waiting" || phase === "connected";
    return () => {
      helpRuntime.askerActive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const voice = useHelpVoice({
    requestId: reqId,
    sessionKey: key,
    role: "asker",
    enabled: kind === "voice" && (phase === "waiting" || (phase === "connected" && (!voiceStarted || talkEndsAt > now))),
  });
  const voiceStateRef = useRef(voice.state);
  voiceStateRef.current = voice.state;

  // الصوت اتوصل عندي: نبلّغ السيرفر (العدّاد بيبدأ لما الاتنين يبلّغوا).
  useEffect(() => {
    if (kind !== "voice" || !reqId || phase !== "connected" || voiceStarted || voice.state !== "connected") return;
    void helpApi.voiceReady(reqId).then((r) => {
      if (r.ok && r.data.started) setVoiceStarted(true);
    });
  }, [kind, reqId, phase, voiceStarted, voice.state]);

  // استطلاع حالة الطلب كل ~2 ثانية.
  useEffect(() => {
    if (!reqId || (phase !== "waiting" && phase !== "connected")) return;
    let stop = false;
    const tick = async () => {
      const r = await helpApi.status(reqId);
      if (stop || !r.ok) return;
      const d = r.data;
      if (d.other) setOther(d.other);
      if (d.status === "accepted") {
        setVoiceStarted(!!d.voiceStarted);
        setTalkEndsAt(d.voiceStarted ? Date.now() + (d.talkLeft ?? 0) * 1000 : 0);
        setCanExtend(!!d.canExtend);
        if (phaseRef.current === "waiting") setPhase("connected");
      }
      if (d.status === "answered") {
        if (d.hintText) onHint(d.hintText, d.hintWrongOption);
        setUsed(true);
        setPhase("done");
      } else if (d.status === "expired" || d.status === "cancelled") {
        setRetryKind(kindRef.current);
        setPhase("expired");
      }
    };
    void tick();
    const t = setInterval(() => void tick(), 2000);
    return () => {
      stop = true;
      clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reqId, phase]);

  // ساعة بتتحدّث كل ثانية أثناء المكالمة (عدّاد وقت الصوت).
  useEffect(() => {
    if (phase !== "connected") return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [phase]);

  // إضافة دقيقة للصوت: إعلان مكافأة (إلا لمشتري فتح المكافآت).
  const extend = async () => {
    if (!reqId || extending) return;
    setExtending(true);
    if (!extendSkipAd) {
      const earned = await showRewarded({ onStart: onAdStart, onEnd: onAdEnd });
      if (!earned) {
        setExtending(false);
        alert("تعذر عرض الإعلان حاليًا، حاول مرة أخرى بعد قليل.");
        return;
      }
    }
    const r = await helpApi.extend(reqId);
    setExtending(false);
    if (!r.ok) {
      toast.error(helpErrorMessage(r.error.code));
      return;
    }
    setCanExtend(false);
    setTalkEndsAt((t) => Math.max(t, Date.now()) + 60_000);
  };

  // عدّاد الـ 60 ثانية وقت الانتظار.
  useEffect(() => {
    if (phase !== "waiting") return;
    const t = setInterval(() => {
      setSecondsLeft(Math.max(0, Math.ceil((expiresRef.current - Date.now()) / 1000)));
    }, 500);
    return () => clearInterval(t);
  }, [phase]);

  // لو اللغز اتقفل/اللاعب مشي والطلب شغال: نلغيه.
  const reqIdRef = useRef<string | null>(null);
  reqIdRef.current = reqId;
  useEffect(() => {
    return () => {
      if (reqIdRef.current && (phaseRef.current === "waiting" || phaseRef.current === "connected")) {
        void helpApi.cancel(reqIdRef.current);
      }
    };
  }, []);

  const start = useCallback(async (wanted: HelpKind) => {
    if (busy || disabled || used) return;
    setPhase("checking");

    const av = await helpApi.availability(riddleIndex);
    if (!av.ok) {
      setPhase("idle");
      toast.error(helpErrorMessage(av.error.code));
      return;
    }
    const a = av.data;
    if (a.limitReached) {
      setPhase("idle");
      toast.error(helpErrorMessage("daily_limit"));
      return;
    }
    if (wanted === "voice" && a.voiceLeft <= 0) {
      setPhase("idle");
      toast.error(helpErrorMessage("voice_limit"));
      return;
    }
    if (wanted === "hint" && a.hintLeft <= 0) {
      setPhase("idle");
      toast.error(helpErrorMessage("hint_limit"));
      return;
    }
    if ((wanted === "voice" ? a.voiceCount : a.hintCount) === 0) {
      setPhase("idle");
      toast.message("مفيش مساعد متاح دلوقتي، جرّب بعد شوية 🙏");
      return;
    }

    // الصوت: إعلان في كل مرة. التلميح: إعلان واحد لكل 5 تلميحات.
    // (إلا مشتري فتح المكافآت / باقة النجدة، أو فرصة مجانية بعد "محدش قبل").
    const freeRetryNow = wanted === "voice" ? a.freeRetryVoice : a.freeRetryHint;
    const adNeeded = wanted === "voice" ? true : a.hintAdNeeded;
    if (!skipAd && !freeRetryNow && adNeeded) {
      const earned = await showRewarded({ onStart: onAdStart, onEnd: onAdEnd });
      if (!earned) {
        setPhase("idle");
        alert("تعذر عرض الإعلان حاليًا، حاول مرة أخرى بعد قليل.");
        return;
      }
    }

    const c = await helpApi.create(riddleIndex, wanted);
    if (!c.ok) {
      setPhase("idle");
      toast.error(helpErrorMessage(c.error.code));
      return;
    }
    setKind(c.data.kind ?? wanted);
    setVoiceStarted(false);
    setTalkEndsAt(0);
    setReqId(c.data.id);
    setKey(c.data.sessionKey);
    expiresRef.current = Date.parse(c.data.expiresAt);
    setSecondsLeft(Math.max(0, Math.ceil((expiresRef.current - Date.now()) / 1000)));
    setOther(null);
    setRetryKind(null);
    setPhase(c.data.status === "accepted" ? "connected" : "waiting");
  }, [busy, disabled, used, riddleIndex, skipAd, onAdStart, onAdEnd]);

  const cancel = async () => {
    if (reqId) await helpApi.cancel(reqId);
    setReqId(null);
    setKey(null);
    setPhase("idle");
  };

  if (phase === "done") {
    return (
      <div className="w-full max-w-4xl mx-auto rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 flex items-center gap-3" dir="rtl">
        <UserAvatar url={other?.avatarUrl} username={other?.username} size="sm" />
        <p className="flex-1 font-typewriter text-sm text-emerald-300">تمت مساعدتك من قبل سَنَد {other?.username ?? "صديق"} 🤝</p>
        {reqId && <AddFriendButton requestId={reqId} />}
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col items-center gap-3" dir="rtl">
      {phase === "idle" || phase === "checking" || phase === "expired" ? (
        <>
          {phase === "expired" && (
            <p className="text-xs text-amber-300 font-typewriter">محدش قبل المساعدة. تقدر تحاول تاني من نفس النوع من غير إعلان.</p>
          )}
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => void start("voice")}
              disabled={disabled || phase === "checking" || used}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary border border-primary/40 text-primary text-sm font-typewriter hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              aria-label="استعن بصديق بالصوت"
            >
              <Phone className="w-4 h-4" />
              <span>
                {phase === "checking"
                  ? "جاري البحث..."
                  : skipAd || retryKind === "voice"
                    ? "استعن بصديق 🎙 صوت"
                    : "🎙 استعن بصديق بالصوت (إعلان)"}
              </span>
            </button>
            <button
              type="button"
              onClick={() => void start("hint")}
              disabled={disabled || phase === "checking" || used}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary border border-primary/40 text-primary text-sm font-typewriter hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              aria-label="تلميح من صديق بدون صوت"
            >
              <span>💡 تلميح من صديق (بدون صوت)</span>
            </button>
          </div>
        </>
      ) : null}

      {phase === "waiting" && (
        <div className="w-full max-w-4xl rounded-xl border border-primary/30 bg-black/50 p-3 flex items-center gap-3">
          <div className="h-3 w-3 rounded-full bg-primary animate-pulse" />
          <p className="flex-1 font-typewriter text-sm text-foreground">
            {kind === "voice" ? "بنطلب مساعدة بالصوت من أصدقاء متاحين" : "بنطلب تلميح من أصدقاء متاحين"}... ({secondsLeft} ث)
          </p>
          <button type="button" onClick={cancel} className="p-2 rounded-full bg-secondary hover:bg-accent" aria-label="إلغاء الطلب">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      )}

      {phase === "connected" && (
        <>
          {kind === "voice" && (
            <HelpVoiceBar
              me={userId}
              requestId={reqId ?? undefined}
              other={other}
              state={voice.state}
              muted={voice.muted}
              needsTap={voice.needsTap}
              onToggleMute={voice.toggleMute}
              onTapToPlay={voice.tapToPlay}
              onBlocked={cancel}
            />
          )}
          <p className="font-typewriter text-xs text-muted-foreground">
            {other?.username ?? "المساعد"} بيفكر معاك... هيظهر لك تلميح على الإجابة.
          </p>
          {kind === "voice" &&
            (!voiceStarted ? (
              <p className="font-typewriter text-xs text-amber-300">🎙 جاري توصيل الصوت... العدّاد هيبدأ أول ما الاتنين يسمعوا بعض.</p>
            ) : talkEndsAt > now ? (
              <p className="font-typewriter text-sm text-primary">⏱ وقت الصوت: {Math.ceil((talkEndsAt - now) / 1000)} ث</p>
            ) : (
              <p className="font-typewriter text-xs text-amber-300">انتهى وقت الصوت — لسه ممكن يوصلك تلميح.</p>
            ))}
          {canExtend && (
            <button
              type="button"
              onClick={extend}
              disabled={extending}
              className="px-3 py-2 rounded-lg bg-secondary border border-primary/40 text-primary text-sm font-typewriter hover:bg-accent disabled:opacity-40"
            >
              {extending ? "..." : extendSkipAd ? "＋ أضف دقيقة للصوت" : "＋ شاهد إعلانًا لإضافة دقيقة للصوت"}
            </button>
          )}
        </>
      )}
    </div>
  );
}
