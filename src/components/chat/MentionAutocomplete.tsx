import UserAvatar from "@/components/chat/UserAvatar";
import type { PublicProfile } from "@/lib/chat/queries";

interface Props {
  candidates: PublicProfile[];
  onPick: (username: string) => void;
}

export default function MentionAutocomplete({ candidates, onPick }: Props) {
  if (candidates.length === 0) return null;
  return (
    <div
      dir="rtl"
      className="mb-1 max-h-40 overflow-y-auto rounded-lg border border-border bg-card shadow-lg divide-y divide-border"
    >
      {candidates.map((p) => (
        <button
          key={p.user_id}
          onClick={() => onPick(p.username ?? "")}
          className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-muted text-right"
        >
          <UserAvatar url={p.avatar_url} username={p.username} size="sm" />
          <span className="text-sm font-typewriter">{p.username}</span>
        </button>
      ))}
    </div>
  );
}
