import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { submitReport } from "@/lib/chat/queries";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  reporterId: string;
  targetUserId: string;
  targetMessageId?: string;
  context: "user" | "message";
}

export default function ReportDialog({ open, onOpenChange, reporterId, targetUserId, targetMessageId, context }: Props) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (reason.trim().length < 3) {
      toast.error("اذكر السبب بشكل واضح");
      return;
    }
    setBusy(true);
    try {
      await submitReport({ reporterId, targetUserId, targetMessageId, reason: reason.trim() });
      toast.success("تم إرسال البلاغ — سيراجعه فريق الإشراف");
      setReason("");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "فشل إرسال البلاغ");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl">
        <DialogHeader>
          <DialogTitle>الإبلاغ {context === "message" ? "عن رسالة" : "عن مستخدم"}</DialogTitle>
          <DialogDescription>
            اشرح المشكلة بإيجاز (مضايقة، تهديد، محتوى غير لائق، انتحال شخصية، إلخ).
          </DialogDescription>
        </DialogHeader>
        <Textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="سبب البلاغ..."
          maxLength={500}
          rows={4}
        />
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button onClick={submit} disabled={busy} variant="destructive">
            {busy ? "جاري الإرسال..." : "إرسال البلاغ"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
