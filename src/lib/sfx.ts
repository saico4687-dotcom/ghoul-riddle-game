// نظام المؤثرات الصوتية: الملفات في public/sounds/<id>.mp3 (بتتضم للتطبيق، صغيرة).
// لو الملف مش موجود، بيشتغل البديل (fallback) لو اتحدد، وإلا بيسكت من غير أي خطأ.
// السيرفر هو اللي بيحدد "رقم" الصوت لما الاختيار يكون بالترتيب (دخلات المصارعين، أصوات صح/غلط).

const KEY = "rabh_sfx_enabled_v1";

// ممكن تنقل الأصوات لأي رابط عام بتغيير VITE_SOUNDS_BASE_URL في .env (من غير تعديل كود).
const RAW_BASE =
  (import.meta.env.VITE_SOUNDS_BASE_URL as string | undefined) || `${import.meta.env.BASE_URL ?? "/"}sounds`;
export const SOUNDS_BASE = RAW_BASE.replace(/\/+$/, "");

export const soundUrl = (id: string): string => `${SOUNDS_BASE}/${id}.mp3`;

export function isSfxEnabled(): boolean {
  try {
    return localStorage.getItem(KEY) !== "0";
  } catch {
    return true;
  }
}

export function setSfxEnabled(on: boolean): void {
  try {
    localStorage.setItem(KEY, on ? "1" : "0");
  } catch {
    /* تجاهل */
  }
}

export interface PlayOpts {
  volume?: number; // 0..1
  fallback?: () => void; // لو الملف مش موجود
  force?: boolean; // يشتغل حتى لو المؤثرات مقفولة (مش مستخدمة حاليًا)
}

// بيشغّل صوت بالـ id (بدون .mp3). كل نداء بيعمل Audio جديد عشان الأصوات تتداخل عادي.
export function playSfx(id: string, opts: PlayOpts = {}): void {
  if (!id) return;
  if (!opts.force && !isSfxEnabled()) return;
  try {
    const a = new Audio(soundUrl(id));
    a.volume = Math.min(1, Math.max(0, opts.volume ?? 1));
    let fell = false;
    const fb = () => {
      if (fell) return;
      fell = true;
      try {
        opts.fallback?.();
      } catch {
        /* تجاهل */
      }
    };
    a.addEventListener("error", fb, { once: true });
    void a.play().catch((e: unknown) => {
      // الملف مش مدعوم/مش موجود => بديل. منع التشغيل التلقائي => نسكت.
      const name = (e as { name?: string })?.name;
      if (name === "NotSupportedError") fb();
    });
  } catch {
    opts.fallback?.();
  }
}

// تحميل مسبق (اختياري) لأصوات هتتشغّل قريب.
export function preloadSfx(ids: string[]): void {
  for (const id of ids) {
    try {
      const a = new Audio(soundUrl(id));
      a.preload = "auto";
      a.load();
    } catch {
      /* تجاهل */
    }
  }
}
