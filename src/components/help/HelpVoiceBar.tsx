import { useState } from "react";
import { Mic, MicOff, Flag, Ban, Volume2 } from "lucide-react";
import { toast } from "sonner";
import UserAvatar from "@/components/chat/UserAvatar";
import ReportDialog from "@/components/chat/ReportDialog";
import { blockUser } from "@/lib/chat/queries";
import type { HelpVoiceState } from "@/hooks/useHelpVoice";
import type { HelpPerson } from "@/lib/helpApi";
import AddFriendButton from "./AddFriendButton";

interface Props {
  me: string;
  requestId?: string;
  other: HelpPerson | null;
  state: HelpVoiceState;
  muted: boolean;
  needsTap: boolean;
  onToggleMute: () => void;
  onTapToPlay: () => void;
  onBlocked?: () => void;
}

const LABEL: Record<HelpVoiceState, string> = {
  idle: "الصوت متوقف",
  connecting: "جاري توصيل الصوت...",
  connected: "الصوت شغال 🎙️",
  failed: "الصوت مش شغال — كمّل بدونه",
  denied: "المايك مش مسموح — كمّل بدون صوت",
};

export default function HelpVoiceBar({ me, requestId, other, state, muted, needsTap, onToggleMute, onTapToPlay, onBlocked }: Props) {
  const [reportOpen, setReportOpen] = useState(false);
  const targetId = other?.id ?? null;

  const handleBlock = async () => {
    if (!targetId) return;
    if (!window.confirm("تحظر اللاعب ده؟ مش هتظهر له ولا هيظهر لك في المساعدة.")) return;
    try {
      await blockUser(me, targetId);
      toast.success("تم الحظر");
      onBlocked?.();
    } catch {
      toast.error("تعذّر الحظر، جرّب تاني");
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto mb-4 rounded-xl border border-primary/30 bg-black/50 p-3 flex flex-col gap-2" dir="rtl">
      <div className="flex items-center gap-3">
        <UserAvatar url={other?.avatarUrl} username={other?.username} size="sm" />
        <div className="flex-1 min-w-0">
          <p className="font-typewriter text-sm text-foreground truncate">سَنَد {other?.username ?? "..."}</p>
          <p className="font-typewriter text-xs text-muted-foreground">{LABEL[state]}</p>
        </div>
        <button
          type="button"
          onClick={onToggleMute}
          disabled={state === "idle" || state === "denied"}
          className="p-2 rounded-full bg-secondary hover:bg-accent disabled:opacity-40"
          aria-label={muted ? "تشغيل المايك" : "كتم المايك"}
        >
          {muted ? <MicOff className="w-5 h-5 text-muted-foreground" /> : <Mic className="w-5 h-5 text-primary" />}
        </button>
        {requestId && <AddFriendButton requestId={requestId} compact />}
        <button type="button" onClick={() => setReportOpen(true)} className="p-2 rounded-full bg-secondary hover:bg-accent" aria-label="إبلاغ">
          <Flag className="w-5 h-5 text-amber-400" />
        </button>
        <button type="button" onClick={handleBlock} className="p-2 rounded-full bg-secondary hover:bg-accent" aria-label="حظر">
          <Ban className="w-5 h-5 text-red-400" />
        </button>
      </div>
      {needsTap && (
        <button
          type="button"
          onClick={onTapToPlay}
          className="flex items-center justify-center gap-2 rounded-lg bg-primary/20 border border-primary/40 py-2 text-primary font-typewriter text-sm"
        >
          <Volume2 className="w-4 h-4" /> اضغط لتشغيل الصوت
        </button>
      )}
      {targetId && (
        <ReportDialog open={reportOpen} onOpenChange={setReportOpen} reporterId={me} targetUserId={targetId} context="user" />
      )}
    </div>
  );
}
