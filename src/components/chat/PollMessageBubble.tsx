import { cn } from "@/lib/utils";
import { CheckCircle2, Circle, Users } from "lucide-react";
import type { GroupPoll, GroupPollOption, GroupPollVote } from "@/lib/chat/groupQueries";

interface Props {
  poll: GroupPoll;
  options: GroupPollOption[];
  votes: GroupPollVote[];
  myUserId: string;
  mine: boolean;
  onVote: (optionId: string) => void;
}

export default function PollMessageBubble({ poll, options, votes, myUserId, mine, onVote }: Props) {
  const totalVoters = new Set(votes.map((v) => v.user_id)).size;
  const closed = !!poll.closed_at && new Date(poll.closed_at).getTime() < Date.now();

  return (
    <div className="min-w-[220px]">
      <div className="flex items-center gap-1.5 mb-2 opacity-90">
        <span className="text-base">📊</span>
        <p className="text-sm font-bold">{poll.question}</p>
      </div>

      <div className="space-y-1.5">
        {options
          .slice()
          .sort((a, b) => a.position - b.position)
          .map((opt) => {
            const optVotes = votes.filter((v) => v.option_id === opt.id);
            const count = optVotes.length;
            const pct = totalVoters === 0 ? 0 : Math.round((count / totalVoters) * 100);
            const votedByMe = optVotes.some((v) => v.user_id === myUserId);

            return (
              <button
                key={opt.id}
                onClick={() => !closed && onVote(opt.id)}
                disabled={closed}
                className={cn(
                  "relative w-full text-right rounded-lg border overflow-hidden px-3 py-1.5 transition-colors",
                  votedByMe ? "border-primary" : "border-current/20",
                  closed ? "opacity-70 cursor-default" : "hover:bg-black/5"
                )}
              >
                <div
                  className="absolute inset-y-0 right-0 bg-current/10"
                  style={{ width: `${pct}%` }}
                  aria-hidden
                />
                <div className="relative flex items-center gap-2">
                  {votedByMe ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> : <Circle className="w-3.5 h-3.5 shrink-0 opacity-60" />}
                  <span className="text-xs flex-1 truncate">{opt.option_text}</span>
                  <span className="text-[10px] opacity-70 shrink-0">{pct}% ({count})</span>
                </div>
              </button>
            );
          })}
      </div>

      <div className={cn("flex items-center gap-1 mt-2 text-[10px] opacity-70", mine ? "justify-start" : "justify-end")}>
        <Users className="w-3 h-3" />
        <span>{totalVoters} صوّتوا{poll.allow_multiple ? " · اختيارات متعددة" : ""}</span>
      </div>
    </div>
  );
}
