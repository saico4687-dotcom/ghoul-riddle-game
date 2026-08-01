import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Plus, X, Loader2, BarChart3 } from "lucide-react";
import { toast } from "sonner";

const MAX_OPTIONS = 10;

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreate: (question: string, options: string[], allowMultiple: boolean) => Promise<void>;
}

export default function PollComposerDialog({ open, onOpenChange, onCreate }: Props) {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [allowMultiple, setAllowMultiple] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setQuestion("");
    setOptions(["", ""]);
    setAllowMultiple(false);
  };

  const updateOption = (i: number, v: string) => {
    setOptions((cur) => cur.map((o, idx) => (idx === i ? v : o)));
  };

  const addOption = () => {
    if (options.length >= MAX_OPTIONS) return;
    setOptions((cur) => [...cur, ""]);
  };

  const removeOption = (i: number) => {
    setOptions((cur) => (cur.length <= 2 ? cur : cur.filter((_, idx) => idx !== i)));
  };

  const submit = async () => {
    const cleanOptions = options.map((o) => o.trim()).filter(Boolean);
    if (question.trim().length < 2) {
      toast.error("اكتب سؤال الاستطلاع");
      return;
    }
    if (cleanOptions.length < 2) {
      toast.error("لازم خيارين على الأقل");
      return;
    }
    setSubmitting(true);
    try {
      await onCreate(question.trim(), cleanOptions, allowMultiple);
      reset();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "تعذر إنشاء الاستطلاع");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4" /> إنشاء استطلاع رأي
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <Input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="اكتب سؤال الاستطلاع..."
            maxLength={200}
          />

          <div className="space-y-2">
            {options.map((opt, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  value={opt}
                  onChange={(e) => updateOption(i, e.target.value)}
                  placeholder={`خيار ${i + 1}`}
                  maxLength={100}
                />
                {options.length > 2 && (
                  <button
                    onClick={() => removeOption(i)}
                    className="p-1 text-muted-foreground hover:text-destructive shrink-0"
                    aria-label="حذف الخيار"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
            {options.length < MAX_OPTIONS && (
              <Button variant="outline" size="sm" onClick={addOption} className="w-full">
                <Plus className="w-4 h-4 ml-1" /> إضافة خيار
              </Button>
            )}
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
            <span className="text-sm font-typewriter">السماح باختيار أكثر من إجابة</span>
            <Switch checked={allowMultiple} onCheckedChange={setAllowMultiple} />
          </div>

          <Button onClick={submit} disabled={submitting} className="w-full">
            {submitting && <Loader2 className="w-4 h-4 animate-spin ml-2" />}
            نشر الاستطلاع
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
