import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { useAdFree } from "@/hooks/useAdFree";

function formatRemaining(ms: number) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

// شريط ساعة عد تنازلي — بياخد مكانه العادي في التخطيط (مش overlay)
// فمبيغطيش على أي حاجة، وبيختفي تلقائياً لو مفيش مكافأة نشطة أو لما
// الوقت يخلص.
export default function AdFreeTimer() {
  const { adFreeUntil, isAdFree } = useAdFree();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!isAdFree) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [isAdFree]);

  if (!isAdFree || !adFreeUntil) return null;

  const remaining = new Date(adFreeUntil).getTime() - now;
  if (remaining <= 0) return null;

  return (
    <div className="w-full bg-yellow-500/10 border-b border-yellow-500/30 px-4 py-1.5 flex items-center justify-center gap-2">
      <Sparkles className="w-3.5 h-3.5 text-yellow-500 shrink-0" />
      <span className="text-[11px] font-typewriter text-yellow-600 dark:text-yellow-400 tabular-nums">
        دردشة بدون إعلانات لمدة {formatRemaining(remaining)}
      </span>
    </div>
  );
}
