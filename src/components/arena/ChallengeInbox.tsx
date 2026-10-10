import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import UserAvatar from "@/components/chat/UserAvatar";
import EntrancePicker from "@/components/arena/EntrancePicker";
import SignForm from "@/components/arena/SignForm";
import { useAuth } from "@/hooks/useAuth";
import { showRewarded } from "@/lib/adsMediation";
import { challengeApi, challengeError, gameName, CHALLENGE_PENDING_EVENT } from "@/lib/challengeApi";
import { helpApi, HELP_AVAILABILITY_EVENT } from "@/lib/helpApi";
import { registerNativePush, PUSH_OPENED_EVENT } from "@/lib/fcm";
import { playSfx } from "@/lib/sfx";
import { SOUND_IDS } from "@/lib/soundCatalog";

// تحدي واصل: الخصم المتاح بيشوفه هنا. "لا أقبل" (صوت ساخر) / "هيا بنا" (جرس + المذيع).
// بيقبل بعد: اختيار دخلة مختلفة عن المتحدّي + التوقيع (لو أول مرة) + إعلان مكافأة.
type Pending = NonNullable<Awaited<ReturnType<typeof challengeApi.inbox>>["data"]["pending"]>;

export default function ChallengeInbox() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [available, setAvailable] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);
  const [step, setStep] = useState<"ask" | "setup">("ask");
  const [entrance, setEntrance] = useState<number | null>(null);
  const [ring, setRing] = useState("");
  const [agree, setAgree] = useState(false);
  const [needSign, setNeedSign] = useState(false);
  const [busy, setBusy] = useState(false);
  const dismissed = useRef<Set<string>>(new Set());
  const sounded = useRef<Set<string>>(new Set());
  const onArena = location.pathname.startsWith("/arena");

  useEffect(() => {
    if (!user) {
      setAvailable(false);
      return;
    }
    let off = false;
    void helpApi.settings().then((r) => {
      if (!off && r.ok) setAvailable(r.data.available);
    });
    const h = (e: Event) => setAvailable(!!(e as CustomEvent<boolean>).detail);
    window.addEventListener(HELP_AVAILABILITY_EVENT, h);
    return () => {
      off = true;
      window.removeEventListener(HELP_AVAILABILITY_EVENT, h);
    };
  }, [user]);

  // تسجيل إشعارات الموبايل لما يكون فيه مستخدم داخل.
  useEffect(() => {
    if (user) void registerNativePush(user.id);
  }, [user]);

  const poll = useCallback(async () => {
    if (document.visibilityState !== "visible" || onArena || busy) return;
    const r = await challengeApi.inbox();
    if (!r.ok) return;
    if (r.data.active) {
      navigate(`/arena/${r.data.active.id}`);
      return;
    }
    const p = r.data.pending && !dismissed.current.has(r.data.pending.id) ? r.data.pending : null;
    window.dispatchEvent(new CustomEvent(CHALLENGE_PENDING_EVENT, { detail: p ? 1 : 0 }));
    setPending((prev) => (prev && p && prev.id === p.id ? prev : p));
    if (p && !sounded.current.has(p.id)) {
      sounded.current.add(p.id);
      setStep("ask");
      setEntrance(null);
      playSfx(SOUND_IDS.challengeInvite);
      void challengeApi.me().then((m) => m.ok && (setNeedSign(!m.data.signed), m.data.ringName && setRing(m.data.ringName)));
    }
  }, [navigate, onArena, busy]);

  // الخصم لازم يكون متاح (نفس مفتاح "أنا متاح للمساعدة") وفاتح التطبيق؛ بنسأل كل 15 ثانية.
  useEffect(() => {
    if (!user || !available) {
      setPending(null);
      return;
    }
    void poll();
    const t = setInterval(() => void poll(), 15000);
    // أول ما اللاعب يرجع للتطبيق نسأل فورًا (من غير ما ينتظر الدورة).
    const onVis = () => {
      if (document.visibilityState === "visible") void poll();
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener(PUSH_OPENED_EVENT, onVis);
    return () => {
      window.removeEventListener(PUSH_OPENED_EVENT, onVis);
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [user, available, poll]);

  const decline = async () => {
    if (!pending) return;
    playSfx(SOUND_IDS.challengeDecline);
    dismissed.current.add(pending.id);
    const id = pending.id;
    setPending(null);
    await challengeApi.respond(id, false);
  };

  const accept = async () => {
    if (!pending || busy || !entrance) return;
    if (needSign && (ring.trim().length < 2 || !agree)) {
      toast.error("اكتب اسمك ووافق على الشروط الأول.");
      return;
    }
    setBusy(true);
    const earned = await showRewarded();
    if (!earned) {
      setBusy(false);
      toast.error("لازم تكمل الإعلان علشان تقبل التحدي.");
      return;
    }
    const r = await challengeApi.respond(pending.id, true, { entrance, ringName: needSign ? ring : undefined });
    setBusy(false);
    if (!r.ok) {
      toast.error(challengeError(r.error.code));
      if (r.error.code !== "same_entrance") {
        dismissed.current.add(pending.id);
        setPending(null);
      }
      return;
    }
    playSfx(SOUND_IDS.challengeAccept);
    const id = pending.id;
    dismissed.current.add(id);
    setPending(null);
    navigate(`/arena/${id}`);
  };

  if (!user || onArena) return null;

  return (
    <Dialog open={!!pending && available} onOpenChange={(o) => !o && !busy && void decline()}>
      <DialogContent className="max-w-sm text-center" dir="rtl">
        <DialogHeader>
          <DialogTitle className="font-horror text-primary">🥊 حد بيتحداك!</DialogTitle>
          <DialogDescription className="font-typewriter">{pending ? `${gameName(pending.game)}${pending.voice ? " — 🎙 بالصوت (هتحتاج الميكروفون)" : ""}` : ""}</DialogDescription>
        </DialogHeader>
        {pending && (
          <div className="flex flex-col items-center gap-3 py-2">
            <UserAvatar url={pending.challenger.avatarUrl} username={pending.challenger.username} size="lg" />
            <p className="font-horror text-xl text-foreground">{pending.challenger.ringName ?? pending.challenger.username}</p>
            {step === "ask" ? (
              <div className="flex gap-3 w-full">
                <Button className="flex-1" onClick={() => setStep("setup")}>هيا بنا</Button>
                <Button className="flex-1" variant="outline" onClick={() => void decline()}>لا أقبل</Button>
              </div>
            ) : (
              <div className="w-full space-y-3">
                <p className="font-typewriter text-sm text-foreground">اختار دخلتك:</p>
                <EntrancePicker value={entrance} onChange={setEntrance} taken={pending.challengerEntrance} />
                {needSign && <SignForm value={ring} onChange={setRing} agree={agree} onAgree={setAgree} />}
                <p className="font-typewriter text-xs text-muted-foreground">هتشوف إعلان قبل ما التحدي يبدأ. واللغز لو ماجاوبتوش قبل كده بيخرج من مسابقة الأسبوع عندك.</p>
                <Button className="w-full" onClick={() => void accept()} disabled={busy || !entrance}>
                  {busy ? "..." : "وقّع وادخل الحلبة"}
                </Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
