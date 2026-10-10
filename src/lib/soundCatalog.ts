// قائمة الأصوات المطلوبة (اسم الملف = id + .mp3 داخل public/sounds/).
// عدد الأصوات المتعددة (الدخلات وأصوات صح/غلط) ثابت هنا وفي السيرفر.

export const ENTRANCE_COUNT = 10; // دخلات المصارعين
export const REACTION_COUNT = 5; // أصوات الإجابة الصحيحة / الغلط (5 + 5)

export const entranceId = (n: number): string => `entrance_${((Math.max(1, Math.floor(n)) - 1) % ENTRANCE_COUNT) + 1}`;
export const correctId = (n: number): string => `correct_${((Math.max(1, Math.floor(n)) - 1) % REACTION_COUNT) + 1}`;
export const wrongId = (n: number): string => `wrong_${((Math.max(1, Math.floor(n)) - 1) % REACTION_COUNT) + 1}`;

export const SOUND_IDS = {
  helpSiren: "help_siren", // وصول إشعار النجدة: سيارة نجدة + جرس افتتاح مباراة
  helpWarning: "help_warning", // المساعد اللي أخطأ: صوت تحذير "قد أخطأت"
  friendRequest: "friend_request", // استلام طلب صداقة
} as const;

export interface CatalogItem {
  id: string;
  desc: string;
}

export const SOUND_CATALOG: CatalogItem[] = [
  { id: SOUND_IDS.helpSiren, desc: "وصول إشعار النجدة (سيارة نجدة + جرس افتتاح مباراة)" },
  { id: SOUND_IDS.helpWarning, desc: "تحذير للمساعد اللي أخطأ في اللغز (قد أخطأت)" },
  { id: SOUND_IDS.friendRequest, desc: "استلام طلب صداقة" },
  ...Array.from({ length: ENTRANCE_COUNT }, (_, i) => ({
    id: `entrance_${i + 1}`,
    desc: `دخلة مصارع رقم ${i + 1} (تظهر للطرف التاني لما يتقبل طلب الصداقة)`,
  })),
  ...Array.from({ length: REACTION_COUNT }, (_, i) => ({ id: `correct_${i + 1}`, desc: `إجابة صحيحة رقم ${i + 1} (فرحة)` })),
  ...Array.from({ length: REACTION_COUNT }, (_, i) => ({ id: `wrong_${i + 1}`, desc: `إجابة غلط رقم ${i + 1} (ضرب / بكاء)` })),
];
