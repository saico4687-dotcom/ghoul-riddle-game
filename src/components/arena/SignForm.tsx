import { useState } from "react";
import { Input } from "@/components/ui/input";

// توقيع التحدي: اسم الحلبة + الموافقة على الشروط.
interface Props {
  value: string;
  onChange: (v: string) => void;
  agree: boolean;
  onAgree: (v: boolean) => void;
}

export default function SignForm({ value, onChange, agree, onAgree }: Props) {
  const [touched, setTouched] = useState(false);
  const bad = touched && (value.trim().length < 2 || value.trim().length > 20);
  return (
    <div className="space-y-3 text-right" dir="rtl">
      <p className="font-typewriter text-sm text-foreground">اكتب اسمك في الحلبة (من 2 لـ 20 حرف):</p>
      <Input
        value={value}
        maxLength={20}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => setTouched(true)}
        placeholder="مثال: الوحش الأسود"
        className="text-right"
      />
      {bad && <p className="text-xs text-red-400 font-typewriter">الاسم لازم يكون من حرفين لـ 20 حرف.</p>}
      <label className="flex items-start gap-2 font-typewriter text-xs text-muted-foreground leading-relaxed cursor-pointer">
        <input type="checkbox" className="mt-1" checked={agree} onChange={(e) => onAgree(e.target.checked)} />
        <span>
          أوقّع على التحدي وأوافق: التحدي بدون نقاط وبدون ترتيب، ولا يدخل في جايزة الأسبوع. وأي لغز يتلعب في التحدي
          ولم أجاوبه قبل كده بيتشال من ترتيب الجايزة عندي. ومشاهدة إعلان مكافأة مطلوبة لبدء التحدي أو قبوله.
        </span>
      </label>
    </div>
  );
}
