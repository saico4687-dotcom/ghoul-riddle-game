import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "pwa-install-dismissed";

export default function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(display-mode: standalone)").matches) return;
    if (localStorage.getItem(DISMISS_KEY)) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (!visible || !deferred) return null;

  const onInstall = async () => {
    await deferred.prompt();
    await deferred.userChoice;
    setVisible(false);
    setDeferred(null);
  };

  const onClose = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
  };

  return (
    <div
      dir="rtl"
      className="fixed bottom-4 inset-x-4 z-50 rounded-2xl border border-primary/30 bg-background/95 backdrop-blur-md p-4 shadow-2xl flex items-center gap-3 animate-in slide-in-from-bottom-4"
    >
      <div className="flex-1">
        <p className="font-bold text-sm">ثبّت تطبيق ربح على جهازك</p>
        <p className="text-xs text-muted-foreground">للوصول السريع واللعب بدون متصفح</p>
      </div>
      <Button size="sm" onClick={onInstall} className="gap-1">
        <Download className="w-4 h-4" />
        تثبيت
      </Button>
      <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1" aria-label="إغلاق">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
