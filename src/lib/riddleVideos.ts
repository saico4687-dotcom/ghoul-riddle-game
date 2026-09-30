// فيديوهات التمهيد (4 ثواني) اللي بتظهر قبل كل لغز.
//
// التسمية: لغز رقم N  ←  N.mp4  (من 1.mp4 لحد 400.mp4)
//
// مكان الملفات (بالترتيب):
//   1) لو VITE_RIDDLE_VIDEOS_BASE_URL متحدد في .env → بيتحمّل من هناك
//      (مثلًا Supabase Storage bucket عام، أو أي CDN). ده الأفضل لأن 400
//      فيديو هيكبّروا حجم تطبيق الأندرويد جدًا لو اتحطوا جواه.
//   2) غير كده → من مجلد public/riddle-videos/ (بيتضم للتطبيق).
const RAW_BASE = (import.meta.env.VITE_RIDDLE_VIDEOS_BASE_URL as string | undefined) || "/riddle-videos";

export const RIDDLE_VIDEO_BASE = RAW_BASE.replace(/\/+$/, "");

// مدة الفيديو المطلوبة بالملي ثانية.
export const RIDDLE_INTRO_MS = 4000;

// عدد الألغاز اللي ليها فيديو حاليًا (من 1 لحد الرقم ده).
// لما ترفع فيديوهات أكتر، زوّد الرقم ده بس (لحد 400).
export const RIDDLE_VIDEOS_AVAILABLE = 100;

export const hasRiddleVideo = (riddleNumber: number): boolean =>
  riddleNumber >= 1 && riddleNumber <= RIDDLE_VIDEOS_AVAILABLE;

export const getRiddleVideoUrl = (riddleNumber: number): string =>
  `${RIDDLE_VIDEO_BASE}/${riddleNumber}.mp4`;
