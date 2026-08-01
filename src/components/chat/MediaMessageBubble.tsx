import { useRef, useState } from "react";
import { Smile, MoreVertical, Flag, Reply, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Message, Reaction } from "@/lib/chat/queries";
import { toggleReaction, canEditMessage, canDeleteForEveryone } from "@/lib/chat/queries";
import { renderMessageBody } from "@/lib/chat/formatting";

const EMOJIS = ["👍", "❤️", "😂", "😮"];

// أقل مسافة سحب (بالبكسل) عشان نعتبرها "طلب رد" — زي خاصية السحب
// الموجودة في واتساب سواء في الشات الفردي أو الجروب
const REPLY_THRESHOLD = 56;
const MAX_DRAG = 84;

interface Props {
  message: Message;
  mine: boolean;
  reactions: Reaction[];
  myUserId: string;
  onReport: (m: Message) => void;
  // بينادَى لما اليوزر يسحب/يشد الرسالة كفاية عشان يرد عليها
  onReply?: (m: Message) => void;
  // الرسالة الأصلية اللي الرسالة دي رد عليها (لو موجودة) — الأب هو
  // اللي بيجيبها من الماب المحلي بتاعه ويمررها هنا عشان نعرضها كاقتباس
  repliedMessage?: Message | null;
  // اسم صاحب الرسالة المقتبَسة يتعرض فوق الاقتباس ("أنت" أو اسم المستخدم)
  repliedSenderLabel?: string;
  // بينادَى لما اليوزر يختار "تعديل" — الأب هو اللي بيحط الرسالة في وضع التعديل بالـ composer
  onEdit?: (m: Message) => void;
  // حذف من عندي فقط (الرسالة تفضل ظاهرة للطرف التاني)
  onDeleteForMe?: (m: Message) => void;
  // حذف للجميع — بيظهر بس لو أنا صاحب الرسالة وخلال 60 ساعة من الإرسال
  onDeleteForEveryone?: (m: Message) => void;
}

export default function MessageBubble({
  message,
  mine,
  reactions,
  myUserId,
  onReport,
  onReply,
  repliedMessage,
  repliedSenderLabel,
  onEdit,
  onDeleteForMe,
  onDeleteForEveryone,
}: Props) {
  const [picker, setPicker] = useState(false);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startXRef = useRef<number | null>(null);
  const triggeredRef = useRef(false);

  const grouped = reactions.reduce<Record<string, { count: number; mine: boolean }>>((acc, r) => {
    if (!acc[r.emoji]) acc[r.emoji] = { count: 0, mine: false };
    acc[r.emoji].count++;
    if (r.user_id === myUserId) acc[r.emoji].mine = true;
    return acc;
  }, {});

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!onReply) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    startXRef.current = e.clientX;
    triggeredRef.current = false;
    setDragging(true);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!onReply || startXRef.current === null) return;
    const delta = e.clientX - startXRef.current;
    const clamped = Math.max(-MAX_DRAG, Math.min(MAX_DRAG, delta));
    setDragX(clamped);
    if (!triggeredRef.current && Math.abs(clamped) >= REPLY_THRESHOLD) {
      triggeredRef.current = true;
      if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(15);
      onReply(message);
    }
  };

  const endDrag = () => {
    startXRef.current = null;
    setDragging(false);
    setDragX(0);
  };

  const replyIconOpacity = Math.min(1, Math.abs(dragX) / REPLY_THRESHOLD);
  const replyIconSide = dragX >= 0 ? "right" : "left";

  return (
    <div className={cn("flex w-full relative", mine ? "justify-start" : "justify-end")} dir="rtl">
      {onReply && (
        <div
          className="absolute top-1/2 -translate-y-1/2 pointer-events-none text-primary"
          style={{
            opacity: replyIconOpacity,
            [replyIconSide]: 4,
          } as React.CSSProperties}
        >
          <Reply className="w-5 h-5" />
        </div>
      )}
      <div
        className={cn("max-w-[80%] group relative touch-pan-y select-none", mine && "order-2")}
        style={{
          transform: `translateX(${dragX}px)`,
          transition: dragging ? "none" : "transform 0.2s ease",
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerLeave={dragging ? endDrag : undefined}
      >
        <div
          className={cn(
            // زجاجية (Glassmorphism): خلفية شبه شفافة + ضبابية + حدّ رفيع فاتح، ونص أبيض
            // في كل الحالات عشان يتناسق مع خلفية الأمواج المتحركة اللي وراه.
            "rounded-2xl px-4 py-2 shadow-lg break-words whitespace-pre-wrap font-typewriter text-sm",
            "backdrop-blur-md border text-white",
            mine
              ? "bg-primary/25 border-primary/40 rounded-bl-sm"
              : "bg-white/10 border-white/20 rounded-br-sm"
          )}
        >
          {repliedMessage && (
            <div
              className={cn(
                "mb-1.5 rounded-md px-2 py-1 border-r-2 text-xs text-white/90 max-w-full overflow-hidden",
                "backdrop-blur-sm bg-white/5",
                mine ? "border-primary/70" : "border-white/50"
              )}
            >
              <div className="font-bold truncate">{repliedSenderLabel ?? "..."}</div>
              <div className="truncate text-white/70">
                {repliedMessage.deleted_at ? "تم حذف الرسالة" : repliedMessage.body}
              </div>
            </div>
          )}
          {message.deleted_at ? (
            <span className="italic text-white/70">تم حذف هذه الرسالة</span>
          ) : (
            renderMessageBody(message.body)
          )}
          <div className="text-[10px] mt-1 text-white/70 flex items-center gap-1 justify-end">
            {message.edited_at && !message.deleted_at && <span>معدَّلة</span>}
            <span>{new Date(message.created_at).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })}</span>
            {mine && (
              <span
                aria-label={message.read_at ? "قُرئت" : message.delivered_at ? "تم التسليم" : "أُرسلت"}
                className={message.read_at ? "text-sky-400" : "text-white/90"}
              >
                {message.read_at ? "✓✓" : message.delivered_at ? "✓✓" : "✓"}
              </span>
            )}
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
          {onReply && (
            <button
              onClick={() => onReply(message)}
              className="p-1 rounded-full bg-card border border-border hover:bg-muted"
              aria-label="رد"
            >
              <Reply className="w-3 h-3" />
            </button>
          )}
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
            <DropdownMenuContent align="start">
              {mine && !message.deleted_at && onEdit && canEditMessage(message) && (
                <DropdownMenuItem onClick={() => onEdit(message)}>
                  <Pencil className="w-3 h-3 ml-2" />
                  تعديل
                </DropdownMenuItem>
              )}
              {onDeleteForMe && !message.deleted_for?.includes(myUserId) && (
                <DropdownMenuItem onClick={() => onDeleteForMe(message)}>
                  <Trash2 className="w-3 h-3 ml-2" />
                  حذف من عندي
                </DropdownMenuItem>
              )}
              {mine && !message.deleted_at && onDeleteForEveryone && canDeleteForEveryone(message) && (
                <DropdownMenuItem onClick={() => onDeleteForEveryone(message)} className="text-destructive">
                  <Trash2 className="w-3 h-3 ml-2" />
                  حذف لدى الجميع
                </DropdownMenuItem>
              )}
              {!mine && (
                <DropdownMenuItem onClick={() => onReport(message)}>
                  <Flag className="w-3 h-3 ml-2" />
                  الإبلاغ عن الرسالة
                </DropdownMenuItem>
              )}
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

