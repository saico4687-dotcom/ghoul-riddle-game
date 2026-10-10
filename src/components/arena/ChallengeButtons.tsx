import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogAction,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// "هل تريد التحدي؟" داخل صفحة اللغز: بصوت (5 يوميًا) أو بدون صوت.
// بيظهر قبل ما اللاعب يجاوب بس؛ لو حل اللغز من غير تحدي الزر بيختفي.
interface Props {
  riddleIndex: number;
  disabled?: boolean;
}

export default function ChallengeButtons({ riddleIndex, disabled }: Props) {
  const navigate = useNavigate();
  const [voice, setVoice] = useState<boolean | null>(null);

  const go = () => {
    const v = voice;
    setVoice(null);
    navigate(`/arena?riddle=${riddleIndex}&voice=${v ? 1 : 0}`);
  };

  return (
    <>
      <div className="flex flex-col items-center gap-2 w-full">
        <p className="font-typewriter text-xs text-muted-foreground">هل تريد التحدي؟ 🥊</p>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={disabled}
            onClick={() => setVoice(true)}
            className="px-4 py-2 rounded-lg border-2 border-red-500/70 bg-red-950/50 text-red-200 font-typewriter text-sm disabled:opacity-40"
          >
            🎙 تحدي بصوت
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => setVoice(false)}
            className="px-4 py-2 rounded-lg border-2 border-red-500/40 bg-red-950/30 text-red-200 font-typewriter text-sm disabled:opacity-40"
          >
            🥊 تحدي بدون صوت
          </button>
        </div>
      </div>
      <AlertDialog open={voice !== null} onOpenChange={(o) => !o && setVoice(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-horror text-primary">تتحدى على اللغز ده؟</AlertDialogTitle>
            <AlertDialogDescription className="font-typewriter text-right leading-relaxed">
              لو صديقك قبل التحدي، اللغز ده <strong>بيخرج من مسابقة الأسبوع</strong> عندك وعنده (من غير نقاط وبدون ترتيب).
              {voice ? " التحدي بالصوت متاح 5 مرات في اليوم، وهيطلب الميكروفون." : " التحدي بدون صوت."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel>رجوع للغز</AlertDialogCancel>
            <AlertDialogAction onClick={go}>يلا نتحدى</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
