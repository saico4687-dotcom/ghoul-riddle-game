import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Menu, Swords, Trophy, MessageCircle, ShoppingBag, Settings as SettingsIcon, LifeBuoy, Shield, FileText,
  Share2, Star, Trash2, LogIn, LogOut,
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useAuth } from "@/hooks/useAuth";
import { CHALLENGE_PENDING_EVENT } from "@/lib/challengeApi";

// قايمة الثلاث شرطات: اختصارات لنفس الصفحات الموجودة (مفيش تكرار في المنطق).
interface Props {
  onLogin: () => void;
  onLogout: () => void;
  loginBusy?: boolean;
}

const PLAY_URL = "https://play.google.com/store/apps/details?id=com.rebh.app";

export default function MainMenu({ onLogin, onLogout, loginBusy }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [confirmOut, setConfirmOut] = useState(false);
  const [pending, setPending] = useState(0);

  useEffect(() => {
    const h = (e: Event) => setPending(Number((e as CustomEvent<number>).detail) || 0);
    window.addEventListener(CHALLENGE_PENDING_EVENT, h);
    return () => window.removeEventListener(CHALLENGE_PENDING_EVENT, h);
  }, []);

  const go = (path: string) => {
    setOpen(false);
    navigate(path);
  };

  const share = async () => {
    setOpen(false);
    const data = { title: "ربح", text: "جرّب لعبة ربح — ألغاز وتحديات وجوائز!", url: PLAY_URL };
    try {
      if (navigator.share) await navigator.share(data);
      else {
        await navigator.clipboard.writeText(PLAY_URL);
        toast.success("تم نسخ رابط التطبيق");
      }
    } catch {
      /* المستخدم لغى المشاركة */
    }
  };

  const Item = ({ icon, label, onClick, badge, danger }: { icon: ReactNode; label: string; onClick: () => void; badge?: number; danger?: boolean }) => (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-3 rounded-lg px-3 py-3 text-right font-typewriter transition hover:bg-primary/10 ${danger ? "text-red-400" : "text-foreground"}`}
    >
      <span className="text-primary">{icon}</span>
      <span className="flex-1">{label}</span>
      {badge ? <span className="rounded-full bg-red-600 px-2 py-0.5 text-xs text-white">{badge}</span> : null}
    </button>
  );

  return (
    <>
      <button
        type="button"
        aria-label="القائمة"
        onClick={() => setOpen(true)}
        className="absolute top-4 left-4 z-20 p-2 rounded-full bg-card/70 border border-primary/40 text-primary hover:bg-card hover:scale-110 transition-all backdrop-blur-sm"
      >
        <Menu className="w-5 h-5" />
        {pending > 0 && <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-red-600 ring-2 ring-background" />}
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-[85vw] max-w-sm overflow-y-auto" dir="rtl">
          <SheetHeader className="text-right">
            <SheetTitle className="font-horror text-primary text-2xl">ربح</SheetTitle>
            <SheetDescription className="font-typewriter">{user ? (user.email ?? "مسجّل الدخول") : "أنت زائر"}</SheetDescription>
          </SheetHeader>

          <div className="mt-4 space-y-1">
            {user ? (
              <>
                <Item icon={<Trophy className="w-5 h-5" />} label="تحدياتك" badge={pending} onClick={() => go("/my-challenges")} />
                <Item icon={<Swords className="w-5 h-5" />} label="حلبة التحدي" onClick={() => go("/arena")} />
                <Item icon={<MessageCircle className="w-5 h-5" />} label="الدردشة والأصدقاء" onClick={() => go("/chat")} />
              </>
            ) : null}
            <Item icon={<ShoppingBag className="w-5 h-5" />} label="شراء إجابات صحيحة" onClick={() => go("/buy-answers")} />
            <Item icon={<SettingsIcon className="w-5 h-5" />} label="الإعدادات" onClick={() => go("/settings")} />
            <Item icon={<LifeBuoy className="w-5 h-5" />} label="خدمة العملاء" onClick={() => go("/support")} />

            <div className="my-2 h-px bg-border" />

            <Item icon={<Shield className="w-5 h-5" />} label="سياسة الخصوصية" onClick={() => go("/privacy")} />
            <Item icon={<FileText className="w-5 h-5" />} label="شروط الاستخدام" onClick={() => go("/terms")} />
            <Item icon={<Share2 className="w-5 h-5" />} label="شارك التطبيق" onClick={() => void share()} />
            <Item icon={<Star className="w-5 h-5" />} label="قيّم التطبيق" onClick={() => { setOpen(false); window.open(PLAY_URL, "_blank"); }} />

            <div className="my-2 h-px bg-border" />

            {user ? (
              <>
                <Item icon={<LogOut className="w-5 h-5" />} label="تسجيل الخروج" onClick={() => setConfirmOut(true)} />
                <Item icon={<Trash2 className="w-5 h-5" />} label="حذف الحساب" danger onClick={() => go("/delete-account")} />
              </>
            ) : (
              <Item icon={<LogIn className="w-5 h-5" />} label={loginBusy ? "جاري الدخول..." : "تسجيل الدخول"} onClick={() => { setOpen(false); onLogin(); }} />
            )}
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={confirmOut} onOpenChange={setConfirmOut}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>تسجيل الخروج؟</AlertDialogTitle>
            <AlertDialogDescription>تقدمك محفوظ على حسابك، تقدر ترجع تدخل في أي وقت.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setConfirmOut(false); setOpen(false); onLogout(); }}>خروج</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
