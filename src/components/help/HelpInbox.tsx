import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import UserAvatar from "@/components/chat/UserAvatar";
import { useAuth } from "@/hooks/useAuth";
import { helpApi, helpErrorMessage, helpRuntime, HELP_AVAILABILITY_EVENT, type HelpPerson } from "@/lib/helpApi";

// صندوق وارد عام: لو اللاعب "متاح للمساعدة" والتطبيق مفتوح، بنسأل السيرفر كل ~5 ثواني.
// (مفيش إشعارات خلفية على أندرويد — الطلب بيوصل بس للي فاتح التطبيق.)

type Pending = { id: string; riddleIndex: number; secondsLeft: number; asker: HelpPerson };
type FriendReq = { id: string; from: HelpPerson };

export default function HelpInbox() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [available, setAvailable] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);
  const [friendReq, setFriendReq] = useState<FriendReq | null>(null);
  const dismissedFriends = useRef<Set<string>>(new Set());
  const dismissed = useRef<Set<string>>(new Set());
  const onSession = location.pathname.startsWith("/help/");

  // نقرأ إعداد "متاح" مرة، ونتابع تغييره من الإعدادات.
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

  const poll = useCallback(async () => {
    if (document.visibilityState !== "visible" || onSession) return;
    const r = await helpApi.inbox();
    if (!r.ok) return;
    // جلسة مساعدة شغالة (رجع للتطبيق وسط المساعدة): نكمّلها.
    if (r.data.active) {
      navigate(`/help/${r.data.active.id}`);
      return;
    }
    if (helpRuntime.askerActive) {
      setPending(null);
      return;
    }
    // طلبات الصداقة اللي اتبعتت من جوه المساعدة (بتظهر لأي لاعب مسجّل).
    const fr = (r.data.friendRequests ?? []).find((f) => !dismissedFriends.current.has(f.id)) ?? null;
    setFriendReq(fr);
    const next = r.data.pending.find((p) => !dismissed.current.has(p.id)) ?? null;
    setPending(next);
  }, [navigate, onSession]);

  // المتاح للمساعدة بيسأل كل 5 ثواني، وباقي اللاعبين كل 20 ثانية (لطلبات الصداقة بس).
  useEffect(() => {
    if (!user) {
      setPending(null);
      setFriendReq(null);
      return;
    }
    if (!available) setPending(null);
    void poll();
    const t = setInterval(() => void poll(), available ? 5000 : 20000);
    return () => clearInterval(t);
  }, [user, available, poll]);

  const respondFriend = async (accept: boolean) => {
    if (!friendReq) return;
    const id = friendReq.id;
    dismissedFriends.current.add(id);
    setFriendReq(null);
    const r = await helpApi.friendRespond(id, accept);
    if (r.ok && accept) toast.success("بقيتوا أصدقاء ✅");
    else if (!r.ok) toast.error(helpErrorMessage(r.error.code));
  };

  const accept = async () => {
    if (!pending || busy) return;
    setBusy(true);
    const r = await helpApi.accept(pending.id);
    setBusy(false);
    if (!r.ok) {
      toast.error(helpErrorMessage(r.error.code));
      dismissed.current.add(pending.id);
      setPending(null);
      return;
    }
    const id = pending.id;
    setPending(null);
    navigate(`/help/${id}`, { state: { accept: r.data } });
  };

  const ignore = () => {
    if (pending) dismissed.current.add(pending.id);
    setPending(null);
  };

  if (!user || onSession) return null;

  return (
    <>
    <Dialog open={!!friendReq} onOpenChange={(o) => { if (!o && friendReq) { dismissedFriends.current.add(friendReq.id); setFriendReq(null); } }}>
      <DialogContent className="max-w-sm text-center" dir="rtl">
        <DialogHeader>
          <DialogTitle className="font-horror text-primary">طلب صداقة 🤝</DialogTitle>
          <DialogDescription className="font-typewriter">اتعرفتوا من خلال جلسة مساعدة</DialogDescription>
        </DialogHeader>
        {friendReq && (
          <div className="flex flex-col items-center gap-3 py-2">
            <UserAvatar url={friendReq.from.avatarUrl} username={friendReq.from.username} size="lg" />
            <p className="font-typewriter text-lg text-foreground">{friendReq.from.username}</p>
            <div className="flex gap-3 w-full">
              <Button className="flex-1" onClick={() => void respondFriend(true)}>قبول</Button>
              <Button className="flex-1" variant="outline" onClick={() => void respondFriend(false)}>رفض</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
    <Dialog open={!!pending && available} onOpenChange={(o) => !o && ignore()}>
      <DialogContent className="max-w-sm text-center" dir="rtl">
        <DialogHeader>
          <DialogTitle className="font-horror text-primary">سَنَد، صديق محتاج مساعدتك 🙋</DialogTitle>
          <DialogDescription className="font-typewriter">لغز حليته صح قبل كده — ساعده يختار الإجابة</DialogDescription>
        </DialogHeader>
        {pending && (
          <div className="flex flex-col items-center gap-3 py-2">
            <UserAvatar url={pending.asker.avatarUrl} username={pending.asker.username} size="lg" />
            <p className="font-typewriter text-lg text-foreground">{pending.asker.username}</p>
            <p className="font-horror text-xl text-primary">ساعدني!</p>
            <div className="flex gap-3 w-full">
              <Button className="flex-1" onClick={accept} disabled={busy}>
                {busy ? "..." : "موافق"}
              </Button>
              <Button className="flex-1" variant="outline" onClick={ignore} disabled={busy}>
                إزالة
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
    </>
  );
}
