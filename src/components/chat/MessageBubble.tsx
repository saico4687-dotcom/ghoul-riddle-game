import { useEffect, useState } from "react";
import { Smile, MoreVertical, Flag } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Message, Reaction } from "@/lib/chat/queries";
import { toggleReaction } from "@/lib/chat/queries";

const EMOJIS = ["👍", "❤️", "😂", "😮"];

interface Props {
  message: Message;
  mine: boolean;
  reactions: Reaction[];
  myUserId: string;
  onReport: (m: Message) => void;
}

export default function MessageBubble({ message, mine, reactions, myUserId, onReport }: Props) {
  const [picker, setPicker] = useState(false);

  const grouped = reactions.reduce<Record<string, { count: number; mine: boolean }>>((acc, r) => {
    if (!acc[r.emoji]) acc[r.emoji] = { count: 0, mine: false };
    acc[r.emoji].count++;
    if (r.user_id === myUserId) acc[r.emoji].mine = true;
    return acc;
  }, {});

  return (
    <div className={cn("flex w-full", mine ? "justify-start" : "justify-end")} dir="rtl">
      <div className={cn("max-w-[80%] group relative", mine && "order-2")}>
        <div
          className={cn(
            "rounded-2xl px-4 py-2 shadow-md break-words whitespace-pre-wrap font-typewriter text-sm",
            mine
              ? "bg-primary text-primary-foreground rounded-bl-sm"
              : "bg-card border border-primary/20 text-foreground rounded-br-sm"
          )}
        >
          {renderWithMentions(message.body)}
          <div className={cn("text-[10px] mt-1 opacity-70", mine ? "text-primary-foreground" : "text-muted-foreground")}>
            {new Date(message.created_at).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })}
            {mine && message.read_at && <span className="mr-1">✓✓</span>}
          </div>
        </div>

        {Object.keys(grouped).length > 0 && (
          <div className={cn("flex gap-1 mt-1", mine ? "justify-start" : "justify-end")}>
            {Object.entries(grouped).map(([emoji, info]) => (
              <button
                key={emoji}
                onClick={() => toggleReaction(message.id, myUserId, emoji)}
                className={cn(
                  "text-xs px-2 py-0.5 rounded-full border",
                  info.mine
                    ? "bg-primary/20 border-primary/40"
                    : "bg-card border-border"
                )}
              >
                {emoji} {info.count}
              </button>
            ))}
          </div>
        )}

        <div
          className={cn(
            "absolute top-1/2 -translate-y-1/2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity",
            mine ? "right-full mr-1" : "left-full ml-1"
          )}
        >
          <button
            onClick={() => setPicker((p) => !p)}
            className="p-1 rounded-full bg-card border border-border hover:bg-muted"
            aria-label="تفاعل"
          >
            <Smile className="w-3 h-3" />
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="p-1 rounded-full bg-card border border-border hover:bg-muted">
                <MoreVertical className="w-3 h-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent dir="rtl" align="start">
              <DropdownMenuItem onClick={() => onReport(message)}>
                <Flag className="w-3 h-3 ml-2" />
                الإبلاغ عن الرسالة
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {picker && (
          <div className={cn("absolute bottom-full mb-1 flex gap-1 bg-card border border-border rounded-full px-2 py-1 shadow-lg", mine ? "left-0" : "right-0")}>
            {EMOJIS.map((e) => (
              <button
                key={e}
                onClick={() => {
                  toggleReaction(message.id, myUserId, e);
                  setPicker(false);
                }}
                className="text-lg hover:scale-125 transition-transform"
              >
                {e}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function renderWithMentions(body: string) {
  const parts = body.split(/(@[A-Za-z0-9_]+)/g);
  return parts.map((p, i) =>
    p.startsWith("@") ? (
      <span key={i} className="text-primary font-bold">
        {p}
      </span>
    ) : (
      <span key={i}>{p}</span>
    )
  );
}
