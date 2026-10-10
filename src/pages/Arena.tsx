import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import HorrorButton from "@/components/HorrorButton";
import EntrancePicker from "@/components/arena/EntrancePicker";
import SignForm from "@/components/arena/SignForm";
import { useAuth } from "@/hooks/useAuth";
import { showRewarded } from "@/lib/adsMediation";
import { challengeApi, challengeError, GAME_LIST } from "@/lib/challengeApi";
import { playSfx } from "@/lib/sfx";
import { SOUND_IDS } from "@/lib/soundCatalog";
import { FROM_RIDDLE_KEY } from "@/lib/helpApi";

// حلبة التحدي: توقيع (مرة) ← اختيار الدخلة ← اختيار اللعبة ← إعلان ← صديق متاح عشوائي.
type Phase = "loading" | "sign" | "menu" | "waiting";

export default function Arena() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const riddleParam = params.get("riddle");
  const fixedRiddle = riddleParam !== null && /^\d+$/.test(riddleParam) ? Number(riddleParam) : undefined;
  const voice = params.get("voice") === "1";
  const { user, loading } = useAuth();
  const [phase, setPhase] = useState<Phase>("loading");
  const [ring, setRing] = useState("");
  const [agree, setAgree] = useState(false);
  const [entrance, setEntrance] = useState<number | null>(null);
  const [game, setGame] = useState<string>("speed");
  const [left, setLeft] = useState(0);
  const [busy, setBusy] = useState(false);
  const [waitId, setWaitId] = useState<string | null>(null);
  const [secs, setSecs] = useState(45);
  const startedAt = useRef(0);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate("/", { replace: true });
      return;
    }
    void challengeApi.me().then((r) => {
      if (!r.ok) {
        toast.error(challengeError(r.error.code));
        setPhase("sign");
        return;
      }
      setLeft(r.data.createLeft);
      if (r.data.ringName) setRing(r.data.ringName);
      setPhase(r.data.signed ? "menu" : "sign");
    });
  }, [user, loading, navigate]);

  const sign = async () => {
    if (busy) return;
    setBusy(true);
    const r = await challengeApi.sign(ring);
    setBusy(false);
    if (!r.ok) {
      toast.error(challengeError(r.error.code));
      return;
    }
    setRing(r.data.ringName);
    setPhase("menu");
  };

  const start = async () => {
    if (busy || !entrance) return;
    setBusy(true);
    const earned = await showRewarded();
    if (!earned) {
      setBusy(false);
      toast.error("لازم تكمل الإعلان علشان تبدأ التحدي. حاول تاني.");
      return;
    }
    const r = await challengeApi.create(game, entrance, { riddleIndex: fixedRiddle, voice: fixedRiddle !== undefined && voice });
    setBusy(false);
    if (!r.ok) {
      toast.error(challengeError(r.error.code));
      if (r.error.code === "already_active") void challengeApi.inbox().then((i) => i.ok && i.data.active && navigate(`/arena/${i.data.active.id}`));
      return;
    }
    playSfx(SOUND_IDS.challengeBell);
    try {
      if (fixedRiddle !== undefined) sessionStorage.setItem(FROM_RIDDLE_KEY, "1");
    } catch {
      /* تجاهل */
    }
    startedAt.current = Date.now();
    setSecs(45);
    setWaitId(r.data.id);
    setPhase("waiting");
  };

  // الانتظار: متابعة رد الخصم.
  useEffect(() => {
    if (phase !== "waiting" || !waitId) return;
    let stop = false;
    const tick = async () => {
      const r = await challengeApi.status(waitId);
      if (stop || !r.ok) return;
      const s = r.data.status;
      if (s === "playing") {
        navigate(`/arena/${waitId}`, { replace: true });
      } else if (s === "declined") {
        toast.message("خصمك رفض التحدي 😅");
        setPhase("menu");
        void challengeApi.me().then((m) => m.ok && setLeft(m.data.createLeft));
      } else if (s === "expired" || s === "cancelled") {
        toast.message("خصمك ما ردّش في الوقت.");
        setPhase("menu");
      }
    };
    const t = setInterval(() => void tick(), 2000);
    const c = setInterval(() => setSecs(Math.max(0, 45 - Math.floor((Date.now() - startedAt.current) / 1000))), 500);
    return () => {
      stop = true;
      clearInterval(t);
      clearInterval(c);
    };
  }, [phase, waitId, navigate]);

  const cancel = async () => {
    if (waitId) await challengeApi.cancel(waitId);
    setPhase("menu");
  };

  if (phase === "loading") {
    return <div className="min-h-screen flex items-center justify-center font-typewriter text-muted-foreground">جاري التحميل...</div>;
  }

  return (
    <div className="min-h-screen bg-horror-gradient px-4 py-6" dir="rtl">
      <div className="max-w-xl mx-auto space-y-5">
        <h1 className="text-center font-horror text-4xl text-primary">🥊 حلبة التحدي</h1>

        {phase === "sign" && (
          <div className="card-horror p-5 space-y-4">
            <h2 className="font-horror text-xl text-primary text-center">وقّع على التحدي</h2>
            <SignForm value={ring} onChange={setRing} agree={agree} onAgree={setAgree} />
            <div className="flex justify-center">
              <HorrorButton onClick={sign} disabled={busy || !agree || ring.trim().length < 2}>
                {busy ? "..." : "أوقّع وأدخل الحلبة"}
              </HorrorButton>
            </div>
          </div>
        )}

        {phase === "menu" && (
          <>
            {fixedRiddle !== undefined && (
              <div className="rounded-lg border border-red-500/60 bg-red-950/40 p-3 text-center font-typewriter text-sm text-red-200">
                تحدي على لغزك رقم {fixedRiddle + 1} {voice ? "🎙 بالصوت" : "(بدون صوت)"}
                <br />
                لو خصمك قبل، اللغز ده بيخرج من مسابقة الأسبوع عندك وعنده.
              </div>
            )}
            <p className="text-center font-typewriter text-sm text-muted-foreground">
              أهلًا يا <span className="text-primary">{ring}</span> — تحديات النهارده المتبقية: {left}
            </p>
            <div className="card-horror p-4 space-y-3">
              <h2 className="font-horror text-xl text-primary text-center">اختار دخلتك</h2>
              <EntrancePicker value={entrance} onChange={setEntrance} />
            </div>
            <div className="card-horror p-4 space-y-3">
              <h2 className="font-horror text-xl text-primary text-center">اختار اللعبة</h2>
              <div className="grid gap-2">
                {GAME_LIST.map((g) => (
                  <button
                    key={g.key}
                    type="button"
                    disabled={!g.ready}
                    onClick={() => setGame(g.key)}
                    className={`text-right rounded-lg border-2 px-3 py-2 transition ${
                      game === g.key && g.ready ? "border-primary bg-primary/15" : "border-border bg-card/60"
                    } ${g.ready ? "" : "opacity-40 cursor-not-allowed"}`}
                  >
                    <span className="font-horror text-lg text-foreground">{g.icon} {g.name}</span>
                    <span className="block font-typewriter text-xs text-muted-foreground">{g.desc}</span>
                  </button>
                ))}
              </div>
            </div>
            <p className="text-center font-typewriter text-xs text-muted-foreground">
              هيتم اختيار صديق متاح عشوائيًا. هتشوف إعلان قبل ما التحدي يبدأ، وخصمك كمان.
            </p>
            <div className="flex flex-col items-center gap-3">
              <HorrorButton onClick={start} disabled={busy || !entrance || left <= 0}>
                {busy ? "..." : !entrance ? "اختار دخلتك الأول" : "🔔 ابدأ التحدي"}
              </HorrorButton>
              <button type="button" className="font-typewriter text-sm text-muted-foreground underline" onClick={() => navigate("/")}>
                رجوع
              </button>
            </div>
          </>
        )}

        {phase === "waiting" && (
          <div className="card-horror p-6 text-center space-y-4">
            <p className="font-horror text-2xl text-primary">بنستنى رد خصمك...</p>
            <p className="font-typewriter text-4xl text-foreground">{secs}</p>
            <HorrorButton onClick={cancel}>إلغاء</HorrorButton>
          </div>
        )}
      </div>
    </div>
  );
}
