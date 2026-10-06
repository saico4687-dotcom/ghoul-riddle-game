import { useState } from "react";
import { UserPlus, Check } from "lucide-react";
import { toast } from "sonner";
import { helpApi, helpErrorMessage } from "@/lib/helpApi";

// زر "أضف صديق" من جوه جلسة المساعدة (من غير فتح الدردشة).
interface Props {
  requestId: string;
  compact?: boolean;
}

export default function AddFriendButton({ requestId, compact }: Props) {
  const [state, setState] = useState<"idle" | "busy" | "sent" | "friends">("idle");

  const click = async () => {
    if (state !== "idle") return;
    setState("busy");
    const r = await helpApi.friendRequest(requestId);
    if (!r.ok) {
      setState("idle");
      toast.error(helpErrorMessage(r.error.code));
      return;
    }
    setState(r.data.status === "already_friends" ? "friends" : "sent");
    toast.success(r.data.status === "already_friends" ? "أنتم أصدقاء ✅" : "اتبعت طلب الصداقة 🤝");
  };

  const label = state === "sent" ? "اتبعت الطلب" : state === "friends" ? "أصدقاء" : "أضف صديق";
  return (
    <button
      type="button"
      onClick={click}
      disabled={state === "busy" || state === "sent" || state === "friends"}
      className={
        compact
          ? "p-2 rounded-full bg-secondary hover:bg-accent disabled:opacity-60"
          : "flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-secondary border border-primary/40 text-primary text-sm font-typewriter hover:bg-accent disabled:opacity-60"
      }
      aria-label="أضف صديق"
    >
      {state === "sent" || state === "friends" ? (
        <Check className="w-5 h-5 text-emerald-400" />
      ) : (
        <UserPlus className="w-5 h-5 text-primary" />
      )}
      {!compact && <span>{label}</span>}
    </button>
  );
}
