import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { riddles } from "@/data/riddles";
import RiddleOption from "@/components/RiddleOption";
import HorrorButton from "@/components/HorrorButton";
import UserAvatar from "@/components/chat/UserAvatar";
import { useAuth } from "@/hooks/useAuth";
import { useHelpVoice } from "@/hooks/useHelpVoice";
import { FROM_RIDDLE_KEY, RESUME_PLAY_KEY } from "@/lib/helpApi";
import { challengeApi, challengeError, gameName, type ChallengeState } from "@/lib/challengeApi";
import { showRewarded } from "@/lib/adsMediation";
import { playSfx } from "@/lib/sfx";
import { entranceId, SOUND_IDS } from "@/lib/soundCatalog";

// شاشة اللعب: مواجهة (العدّ التنازلي + الدخلات) ← اللغز ← النتيجة. الزمن كله بساعة السيرفر.
function ArenaDuelInner() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [st, setSt] = useState<ChallengeState | null>(null);
  const [now, setNow] = useState(Date.now());
  const [sending, setSending] = useState(false);
  const offset = useRef(0); // serverNow - Date.now()
  const introPlayed = useRef(false);
  const resultPlayed = useRef(false);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate("/", { replace: true });
      return;
    }
    if (!id) return;
    let stop = false;
    const tick = async () => {
      const r = await challengeApi.status(id);
      if (stop) return;
      if (!r.ok) {
        if (r.error.status === 404) {
          toast.error("التحدي مش موجود.");
          navigate("/", { replace: true });
        }
        return;
      }
      offset.current = r.data.serverNow - Date.now();
      setSt(r.data);
    };
    void tick();
    const t = setInterval(() => void tick(), 1500);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [id, user, loading, navigate]);

  const sNow = now + offset.current;

  // دخلتك ثم دخلة خصمك أول ما المواجهة تبان.
  useEffect(() => {
    if (!st || st.status !== "playing" || introPlayed.current) return;
    introPlayed.current = true;
    if (st.entranceSelf) playSfx(entranceId(st.entranceSelf));
    if (st.entranceOther) setTimeout(() => playSfx(entranceId(st.entranceOther!)), 2500);
  }, [st]);

  useEffect(() => {
    if (st?.status !== "finished" || resultPlayed.current || !st.result) return;
    resultPlayed.current = true;
    if (st.result.winner === "me") playSfx(SOUND_IDS.challengeWin);
    else if (st.result.winner === "other") playSfx(SOUND_IDS.challengeLose);
  }, [st]);

  const riddle = st ? riddles[st.riddleIndex] : null;

  // الصوت (لو التحدي بصوت): المتحدّي بيبدأ الاتصال، والخصم بيرد. بيقفل لما التحدي يخلص.
  const voice = useHelpVoice({
    requestId: st?.voice ? (id ?? null) : null,
    sessionKey: st?.voice ? st.sessionKey : null,
    role: st?.role === "challenger" ? "helper" : "asker",
    enabled: !!st && st.voice && st.status === "playing",
  });

  // الحلبة المتحركة: ترتيب الاختيارات بيتبدّل كل ثانيتين (ثابت لنفس اللحظة).
  const order = useMemo(() => {
    if (!riddle) return [] as number[];
    const base = riddle.options.map((_, i) => i);
    if (st?.game !== "moving" || !st.startsAt) return base;
    const tickNo = Math.max(0, Math.floor((sNow - st.startsAt) / 2000));
    const out = [...base];
    let seed = tickNo * 9301 + 49297;
    for (let i = out.length - 1; i > 0; i--) {
      seed = (seed * 9301 + 49297) % 233280;
      const j = Math.floor((seed / 233280) * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [riddle, st?.game, st?.startsAt, Math.floor((sNow - (st?.startsAt ?? 0)) / 2000)]);

  // الاتنين وافقوا على الاستمرار: ندخل الجولة الجديدة.
  useEffect(() => {
    const next = st?.rematch?.nextId;
    if (next) navigate(`/arena/${next}`, { replace: true });
  }, [st?.rematch?.nextId, navigate]);

  const [voting, setVoting] = useState(false);
  const vote = async (yes: boolean) => {
    if (!id || voting) return;
    if (!yes) {
      void challengeApi.rematch(id, false);
      back();
      return;
    }
    setVoting(true);
    const earned = await showRewarded();
    if (!earned) {
      setVoting(false);
      toast.error("لازم تكمل الإعلان علشان تكمل التحدي.");
      return;
    }
    const r = await challengeApi.rematch(id, true);
    setVoting(false);
    if (!r.ok) {
      toast.error(challengeError(r.error.code));
      return;
    }
    setSt(r.data);
  };

  const send = async (option: string) => {
    if (!id || sending || !st?.canAnswer) return;
    setSending(true);
    const r = await challengeApi.answer(id, option);
    setSending(false);
    if (!r.ok) {
      toast.error(r.error.code === "too_late" ? "الوقت خلص." : challengeError(r.error.code));
      return;
    }
    setSt(r.data);
  };

  if (!st || !riddle) {
    return <div className="min-h-screen flex items-center justify-center font-typewriter text-muted-foreground">جاري التحميل...</div>;
  }

  const back = () => {
    try {
      if (sessionStorage.getItem(FROM_RIDDLE_KEY)) {
        sessionStorage.removeItem(FROM_RIDDLE_KEY);
        sessionStorage.setItem(RESUME_PLAY_KEY, "1");
      }
    } catch {
      /* تجاهل */
    }
    navigate("/", { replace: true });
  };
  const shell = (children: ReactNode) => (
    <div className="min-h-screen bg-horror-gradient px-4 py-6" dir="rtl">
      <div className="max-w-3xl mx-auto space-y-4">{children}</div>
    </div>
  );

  if (st.status === "declined" || st.status === "expired" || st.status === "cancelled") {
    return shell(
      <div className="card-horror p-6 text-center space-y-3">
        <p className="font-horror text-2xl text-primary">التحدي انتهى</p>
        <HorrorButton onClick={back}>رجوع</HorrorButton>
      </div>,
    );
  }

  const voiceBar =
    st.voice && st.status === "playing" ? (
      <div className="flex items-center justify-center gap-3 font-typewriter text-xs text-muted-foreground">
        <span>
          🎙{" "}
          {voice.state === "connected"
            ? "الصوت متوصل"
            : voice.state === "denied"
              ? "الميكروفون مرفوض (اللعب بدون صوت)"
              : voice.state === "failed"
                ? "تعذّر الصوت (اللعب بدون صوت)"
                : "جاري توصيل الصوت..."}
        </span>
        {voice.state === "connected" && (
          <button type="button" onClick={voice.toggleMute} className="rounded border border-border px-2 py-1">
            {voice.muted ? "🔇 إلغاء الكتم" : "🔈 كتم"}
          </button>
        )}
        {voice.needsTap && (
          <button type="button" onClick={voice.tapToPlay} className="rounded border border-primary px-2 py-1 text-primary">
            اضغط لتشغيل الصوت
          </button>
        )}
      </div>
    ) : null;

  const versus = (
    <div className="flex items-center justify-around card-horror p-4">
      <div className="text-center">
        <UserAvatar url={null} username={st.ringSelf ?? "أنا"} size="lg" />
        <p className="font-horror text-lg text-primary mt-1">{st.ringSelf ?? "أنا"}</p>
      </div>
      <span className="font-horror text-3xl text-foreground">VS</span>
      <div className="text-center">
        <UserAvatar url={st.other?.avatarUrl} username={st.ringOther ?? st.other?.username} size="lg" />
        <p className="font-horror text-lg text-primary mt-1">{st.ringOther ?? st.other?.username}</p>
      </div>
    </div>
  );

  if (st.status === "finished" && st.result) {
    const r = st.result;
    const sc = st.series ?? { meWins: 0, otherWins: 0, draws: 0, rounds: 1 };
    const title = r.winner === "me" ? "🏆 كسبت الجولة!" : r.winner === "other" ? "💀 خسرت الجولة" : "🤝 تعادل";
    const otherName = st.ringOther ?? st.other?.username ?? "خصمك";
    const rm = st.rematch;
    const otherRefused = rm?.other === false;
    const waitingOther = rm?.me === true && rm?.other === null;
    const expired = rm?.expiresAt ? sNow > rm.expiresAt : false;
    return shell(
      <>
        {versus}
        <div className="card-horror p-6 text-center space-y-3">
          <h2 className="font-horror text-3xl text-primary">{title}</h2>
          <p className="font-horror text-6xl text-foreground tracking-widest" dir="ltr">
            {sc.meWins} : {sc.otherWins}
          </p>
          <p className="font-typewriter text-xs text-muted-foreground">
            {st.ringSelf ?? "أنا"} : {otherName}
            {sc.draws > 0 ? ` — تعادل ${sc.draws}` : ""}
          </p>
          <p className="font-typewriter text-lg text-primary">
            {r.winner === "draw" ? "الجولة انتهت بالتعادل" : `الفائز: ${r.winner === "me" ? (st.ringSelf ?? "أنت") : otherName}`}
          </p>
          <p className="font-typewriter text-sm text-muted-foreground">
            إجابتك: {r.meCorrect ? "صح ✅" : "غلط ❌"} — إجابة خصمك: {r.otherCorrect ? "صح ✅" : "غلط ❌"}
          </p>
          <p className="font-typewriter text-xs text-muted-foreground">التحدي بدون نقاط وخارج ترتيب الأسبوع.</p>

          {otherRefused ? (
            <p className="font-typewriter text-sm text-foreground">{otherName} اختار ينهي التحدي.</p>
          ) : expired ? (
            <p className="font-typewriter text-sm text-foreground">انتهت مهلة الاستمرار.</p>
          ) : waitingOther ? (
            <p className="font-typewriter text-sm text-foreground">بنستنى رد {otherName}...</p>
          ) : (
            <div className="space-y-2">
              <p className="font-horror text-xl text-foreground">هل تريد استمرار التحدي؟</p>
              {rm?.other === true && <p className="font-typewriter text-xs text-primary">{otherName} موافق ✅</p>}
              <div className="flex gap-3 justify-center">
                <HorrorButton onClick={() => void vote(true)} disabled={voting}>
                  {voting ? "..." : "نعم"}
                </HorrorButton>
                <HorrorButton onClick={() => void vote(false)} disabled={voting}>
                  لا
                </HorrorButton>
              </div>
              <p className="font-typewriter text-xs text-muted-foreground">"نعم" بتعرض إعلان قبل الجولة الجديدة.</p>
            </div>
          )}

          <div className="flex gap-3 justify-center pt-2">
            <button type="button" className="font-typewriter text-sm text-muted-foreground underline" onClick={() => navigate("/my-challenges")}>
              تحدياتك
            </button>
            <button type="button" className="font-typewriter text-sm text-muted-foreground underline" onClick={back}>
              رجوع للرئيسية
            </button>
          </div>
        </div>
      </>,
    );
  }

  const startsAt = st.startsAt ?? 0;
  if (sNow < startsAt) {
    return shell(
      <>
        {versus}
        {voiceBar}
        <div className="card-horror p-6 text-center">
          <p className="font-typewriter text-muted-foreground">{gameName(st.game)}</p>
          <p className="font-horror text-6xl text-primary mt-2">{Math.max(1, Math.ceil((startsAt - sNow) / 1000))}</p>
        </div>
      </>,
    );
  }

  const revealAt = st.revealAt ?? startsAt;
  const hidden = st.game === "memory" && sNow < revealAt; // السؤال بس
  const questionHidden = st.game === "memory" && sNow >= revealAt;
  const myBase = st.myBase ?? revealAt;
  const left = Math.max(0, Math.ceil((myBase + st.windowMs - sNow) / 1000));
  const waitingTurn = st.sequential && st.role === "opponent" && !st.canAnswer && !st.meDone;

  return shell(
    <>
      {versus}
      {voiceBar}
      <p className="text-center font-typewriter text-sm text-muted-foreground">
        {gameName(st.game)}
        {st.canAnswer && !hidden ? ` — باقي ${left} ث` : ""}
      </p>

      {!questionHidden && (
        <div className="card-horror p-6">
          <p className="text-xl md:text-2xl leading-relaxed text-right font-typewriter">{riddle.question}</p>
          {hidden && <p className="text-center text-primary font-horror mt-3">احفظ السؤال... هيختفي! {Math.max(1, Math.ceil((revealAt - sNow) / 1000))}</p>}
        </div>
      )}
      {questionHidden && <p className="text-center font-horror text-primary">السؤال اختفى — اختار الإجابة من الذاكرة</p>}

      {st.challengerPick && (
        <p className="text-center font-typewriter text-sm text-primary">خصمك اختار: «{st.challengerPick}» (مش بنقولك صح ولا غلط)</p>
      )}

      {st.meDone ? (
        <div className="card-horror p-5 text-center font-typewriter text-foreground">تم إرسال إجابتك ✅ — بنستنى خصمك...</div>
      ) : waitingTurn ? (
        <div className="card-horror p-5 text-center font-typewriter text-foreground">دور خصمك الأول... استنى</div>
      ) : (
        !hidden && (
          <div className="space-y-4">
            {order.map((oi) => (
              <RiddleOption
                key={oi}
                option={riddle.options[oi]}
                index={oi}
                selected={false}
                showResult={false}
                isCorrect={false}
                onClick={() => void send(riddle.options[oi])}
                disabled={sending || !st.canAnswer}
              />
            ))}
          </div>
        )
      )}
    </>,
  );
}

export default function ArenaDuel() {
  const { id } = useParams<{ id: string }>();
  // مفتاح بالـ id: كل جولة جديدة بتبدأ بحالة نضيفة (الدخلات والنتيجة).
  return <ArenaDuelInner key={id} />;
}
