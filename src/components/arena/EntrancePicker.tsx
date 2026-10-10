import { playSfx } from "@/lib/sfx";
import { ENTRANCE_COUNT, entranceId } from "@/lib/soundCatalog";

// اختيار دخلة المصارع (1..10). الضغط بيسمّعك الدخلة. اللي خصمك اختارها مقفولة.
interface Props {
  value: number | null;
  onChange: (n: number) => void;
  taken?: number | null;
}

export default function EntrancePicker({ value, onChange, taken }: Props) {
  return (
    <div className="grid grid-cols-5 gap-2" dir="rtl">
      {Array.from({ length: ENTRANCE_COUNT }, (_, i) => i + 1).map((n) => {
        const blocked = taken === n;
        const on = value === n;
        return (
          <button
            key={n}
            type="button"
            disabled={blocked}
            onClick={() => {
              onChange(n);
              playSfx(entranceId(n));
            }}
            className={`rounded-lg border-2 py-3 font-horror text-xl transition ${
              on ? "border-primary bg-primary/20 text-primary" : "border-border bg-card/60 text-foreground"
            } ${blocked ? "opacity-30 line-through cursor-not-allowed" : "hover:border-primary/70"}`}
          >
            {n}
          </button>
        );
      })}
      {taken ? <p className="col-span-5 text-center font-typewriter text-xs text-muted-foreground">الدخلة رقم {taken} اختارها خصمك</p> : null}
    </div>
  );
}
