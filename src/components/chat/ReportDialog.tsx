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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { submitReport } from "@/lib/chat/queries";
import { reportGroupContent } from "@/lib/chat/groupQueries";
import { REPORT_CATEGORIES, type ReportCategory } from "@/lib/chat/reportCategories";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  reporterId: string;
  targetUserId: string;
  targetMessageId?: string;
  context: "user" | "message";
  // لو اتحدد groupId، البلاغ بيتسجل في group_reports بدل reports العادي
  // (بلاغ عن عضو/رسالة داخل جروب معيّن بدل محادثة فردية).
  groupId?: string;
}

export default function ReportDialog({
  open,
  onOpenChange,
  reporterId,
  targetUserId,
  targetMessageId,
  context,
  groupId,
}: Props) {
  const [category, setCategory] = useState<ReportCategory>("spam");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (reason.trim().length < 3) {
      toast.error("اذكر تفاصيل إضافية عن السبب");
      return;
    }
    setBusy(true);
    try {
      if (groupId) {
        await reportGroupContent({
          reporterId,
          groupId,
          targetUserId,
          targetMessageId,
          reason: reason.trim(),
          category,
        });
      } else {
        await submitReport({
          reporterId,
          targetUserId,
          targetMessageId,
          reason: reason.trim(),
          category,
        });
      }
      toast.success("تم إرسال البلاغ — سيراجعه فريق الإشراف");
      setReason("");
      setCategory("spam");
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
          <DialogDescription>اختر نوع المشكلة، واشرح التفاصيل بإيجاز.</DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label>نوع البلاغ</Label>
          <Select value={category} onValueChange={(v) => setCategory(v as ReportCategory)}>
            <SelectTrigger dir="rtl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {REPORT_CATEGORIES.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>تفاصيل إضافية</Label>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="اشرح المشكلة بالتفصيل..."
            maxLength={500}
            rows={4}
          />
        </div>

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
