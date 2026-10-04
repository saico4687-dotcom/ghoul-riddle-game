// منطق نقي (من غير أي اتصال بقاعدة بيانات) عشان نقدر نختبره بسهولة.

export const QUESTION_TIMER_MS = 60_000; // نفس مؤقت اللغز في التطبيق
// أقل زمن بيتسجّل في الترتيب. أي إجابة أسرع من كده بيتم رفعها لهذا الحد،
// لأن الإنسان مش بيقدر يقرا الاختيارات ويضغط أسرع من كده.
export const MIN_RANKED_MS = 1500;

export function normalize(s: string): string {
  return s.normalize("NFC").replace(/\s+/g, " ").trim();
}

export function isAnswerCorrect(selected: string | null, correct: string): boolean {
  if (selected === null) return false;
  return normalize(selected) === normalize(correct);
}

// الزمن اللي بيتسجّل للترتيب: بين الحد الأدنى والمؤقت الكامل.
export function rankedElapsed(elapsedMs: number): number {
  return Math.min(Math.max(elapsedMs, MIN_RANKED_MS), QUESTION_TIMER_MS);
}

// نفس معادلة التطبيق: 10 نقاط للإجابة الصحيحة + بونص سرعة من 0 لـ 5.
export function scoreFor(isCorrect: boolean, elapsedMs: number) {
  if (!isCorrect) return { pointsEarned: 0, bonusEarned: 0 };
  let bonusEarned = 0;
  if (elapsedMs >= 250 && elapsedMs <= QUESTION_TIMER_MS) {
    const remainingSec = Math.max(0, Math.floor((QUESTION_TIMER_MS - elapsedMs) / 1000));
    bonusEarned = Math.min(5, Math.floor(remainingSec / 12));
  }
  return { pointsEarned: 10 + bonusEarned, bonusEarned };
}

// "حذف إجابتين": بيختار اتنين غلط عشوائيًا من الأربعة اللي الموبايل بعتهم.
// بيرجّع null لو الاختيارات مش سليمة (مش أربعة، أو متكررة، أو مفيهاش الإجابة الصحيحة).
export function pickFiftyRemoval(
  options: unknown,
  correct: string,
  rand: () => number = Math.random,
): string[] | null {
  if (!Array.isArray(options) || options.length !== 4) return null;
  if (!options.every((o) => typeof o === "string" && o.length > 0 && o.length <= 500)) return null;
  const list = options as string[];
  const normalized = list.map(normalize);
  if (new Set(normalized).size !== 4) return null;
  const target = normalize(correct);
  if (!normalized.includes(target)) return null;
  const wrong = list.filter((_, i) => normalized[i] !== target);
  // Fisher-Yates مختصر
  for (let i = wrong.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [wrong[i], wrong[j]] = [wrong[j], wrong[i]];
  }
  return wrong.slice(0, 2);
}
