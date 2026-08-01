// الفئات الست الثابتة للإبلاغ — نفس الفئات المستخدمة فعليًا في واتساب/ماسنجر،
// تُستخدم في نموذج الإبلاغ (ReportDialog) ولوحة الإشراف (AdminModeration) معًا
// حتى تتطابق القيمة المخزَّنة في العمود category بقاعدة البيانات مع ما يُعرض هنا.

export type ReportCategory =
  | "spam"
  | "harassment"
  | "inappropriate_content"
  | "impersonation"
  | "violence_threat"
  | "other";

export const REPORT_CATEGORIES: { id: ReportCategory; label: string }[] = [
  { id: "spam", label: "رسائل مزعجة / إعلانات (Spam)" },
  { id: "harassment", label: "مضايقة أو تنمّر" },
  { id: "inappropriate_content", label: "محتوى غير لائق" },
  { id: "impersonation", label: "انتحال شخصية" },
  { id: "violence_threat", label: "تهديد أو تحريض على العنف" },
  { id: "other", label: "سبب آخر" },
];

export function reportCategoryLabel(category: string | null | undefined): string {
  return REPORT_CATEGORIES.find((c) => c.id === category)?.label ?? "سبب آخر";
}
