import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { riddles } from "@/data/riddles";
import RiddleOption from "@/components/RiddleOption";
import HorrorButton from "@/components/HorrorButton";
import HelpVoiceBar from "@/components/help/HelpVoiceBar";
import AddFriendButton from "@/components/help/AddFriendButton";
import UserAvatar from "@/components/chat/UserAvatar";
import { useHelpVoice } from "@/hooks/useHelpVoice";
import { useAuth } from "@/hooks/useAuth";
import { helpApi, helpErrorMessage, RESUME_PLAY_KEY, type HelpPerson } from "@/lib/helpApi";
import moneyBg from "@/assets/money-bg.jpg";
import riddleCompetitionVideo from "@/assets/riddle-competition.mp4";

// صفحة المساعد: نفس شكل اللغز (السؤال + الخيارات + فيديو البانر، من غير فيديو المقدمة).
// بعد الإرسال: شكر + نقاط، وبعدها رجوع تلقائي للغز اللي كان بيحله (من أوله).

export default function HelperSession() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [riddleIndex, setRiddleIndex] = useState<number | null>(null);
  const [sessionKey, setSessionKey] = useState<string | null>(null);
  const [asker, setAsker] = useState<HelpPerson | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState<{ correct: boolean; points: number } | null>(null);
  const [live, setLive] = useState(true);
  const [talkEndsAt, setTalkEndsAt] = useState(0);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const goBack = () => {
    try {
      sessionStorage.setItem(RESUME_PLAY_KEY, "1");
    } catch {
      /* تجاهل */
    }
    navigate("/", { replace: true });
  };

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate("/", { replace: true });
      return;
    }
    if (!id) return;
    let stop = false;
    const tick = async () => {
      const r = await helpApi.status(id);
      if (stop) return;
      if (!r.ok) {
        if (r.error.status === 404 || r.error.status === 403) {
          toast.error("الطلب مش متاح.");
          goBack();
        }
        return;
      }
      const d = r.data;
      if (d.role !== "helper") {
        goBack();
        return;
      }
      setRiddleIndex(d.riddleIndex);
      setSessionKey(d.sessionKey);
      setAsker(d.other);
      if (d.status === "accepted") setTalkEndsAt(Date.now() + (d.talkLeft ?? 0) * 1000);
      if (d.status === "answered") {
        setLive(false);
        setDone((prev) => prev ?? { correct: (d.helperPoints ?? 0) > 0, points: d.helperPoints ?? 0 });
      } else if (d.status !== "accepted") {
        setLive(false);
        if (!done) {
          toast.message("انتهى وقت المساعدة.");
          goBack();
        }
      }
    };
    void tick();
    const t = setInterval(() => void tick(), 3000);
    return () => {
      stop = true;
      clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, user, loading]);

  const voice = useHelpVoice({
    requestId: id ?? null,
    sessionKey,
    role: "helper",
    enabled: live && !done && !!sessionKey && talkEndsAt > now,
  });

  // بعد الشكر نرجع تلقائي.
  useEffect(() => {
    if (!done) return;
    const t = setTimeout(goBack, 12000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);

  const riddle = riddleIndex !== null ? riddles[riddleIndex] : null;

  const send = async () => {
    if (!id || !riddle || selected === null || sending) return;
    setSending(true);
    const r = await helpApi.pick(id, riddle.options[selected]);
    setSending(false);
    if (!r.ok) {
      toast.error(helpErrorMessage(r.error.code));
      if (r.error.status === 410 || r.error.status === 409) goBack();
      return;
    }
    setLive(false);
    setDone({ correct: r.data.correct, points: r.data.points });
  };

  if (!riddle || !user) {
    return <div className="min-h-screen flex items-center justify-center font-typewriter text-muted-foreground">جاري التحميل...</div>;
  }

  return (
    <div
      className="min-h-screen w-full px-4 py-6"
      dir="rtl"
      style={{
        backgroundImage: `linear-gradient(rgba(0,0,0,0.78), rgba(0,0,0,0.85)), url(${moneyBg})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
      }}
    >
      <div className="max-w-4xl mx-auto">
        <HelpVoiceBar
          me={user.id}
          requestId={id}
          other={asker}
          state={voice.state}
          muted={voice.muted}
          needsTap={voice.needsTap}
          onToggleMute={voice.toggleMute}
          onTapToPlay={voice.tapToPlay}
          onBlocked={goBack}
        />

        <p className="text-center font-typewriter text-sm text-muted-foreground mb-2">
          {talkEndsAt > now ? `⏱ وقت الصوت: ${Math.ceil((talkEndsAt - now) / 1000)} ث` : "انتهى وقت الصوت — اختار الإجابة وابعتها"}
        </p>
        <p className="text-center text-primary font-horror text-xl mb-4">بتكون سَنَد لـ {asker?.username ?? "صديق"} في اللغز {riddleIndex! + 1}</p>

        <div className="image-horror mb-6">
          <video src={riddleCompetitionVideo} className="w-full max-h-64 object-cover" autoPlay loop muted playsInline />
        </div>

        <div className="card-horror p-6 mb-6">
          <p className="text-xl md:text-2xl leading-relaxed text-right font-typewriter">{riddle.question}</p>
        </div>

        {done ? (
          <div className="card-horror p-6 text-center flex flex-col items-center gap-3">
            <UserAvatar url={asker?.avatarUrl} username={asker?.username} size="lg" />
            <h3 className="font-horror text-2xl text-primary">
              {done.points > 0 ? `شكرًا لمساعدتك ${asker?.username ?? ""}، +${done.points} نقطة 🎉` : `شكرًا لمساعدتك ${asker?.username ?? ""} 🙏`}
            </h3>
            <p className="font-typewriter text-sm text-muted-foreground">هترجع للغزك من أوله...</p>
            {id && <AddFriendButton requestId={id} />}
            <HorrorButton onClick={goBack}>ارجع للغزي</HorrorButton>
          </div>
        ) : (
          <>
            <div className="space-y-4 mb-6">
              {riddle.options.map((o, i) => (
                <RiddleOption
                  key={i}
                  option={o}
                  index={i}
                  selected={selected === i}
                  showResult={false}
                  isCorrect={false}
                  onClick={() => !sending && setSelected(i)}
                  disabled={sending}
                />
              ))}
            </div>
            <div className="flex justify-center">
              <HorrorButton onClick={send} disabled={selected === null || sending}>
                {sending ? "جاري الإرسال..." : "إرسال الإجابة لصديقك"}
              </HorrorButton>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
