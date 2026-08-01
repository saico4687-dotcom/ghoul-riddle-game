-- إضافة فئات إبلاغ ثابتة (6 فئات) لجدولي reports و group_reports، بدل
-- الاعتماد على نص حر فقط. هذا يسمح للوحة الإشراف (AdminModeration) بفرز/تمييز
-- البلاغات حسب النوع (Spam / مضايقة / محتوى غير لائق / انتحال شخصية / تهديد / أخرى)
-- بنفس الفئات المستخدمة فعليًا في واتساب وماسنجر.
--
-- ملاحظة: فحصت صلاحيات RLS الفعلية على قاعدة البيانات المتصلة (وليس نسخة
-- الملفات المرفوعة، التي كانت أقدم) ووجدت إنها بالفعل تسمح للمشرف العام
-- برؤية والتصرف في بلاغات الجروبات عبر دالة is_admin() — فمفيش داعي لأي
-- تعديل RLS إضافي هنا، العمود الجديد فقط هو المطلوب.

ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'other';

ALTER TABLE public.reports DROP CONSTRAINT IF EXISTS reports_category_check;
ALTER TABLE public.reports
  ADD CONSTRAINT reports_category_check CHECK (
    category IN ('spam', 'harassment', 'inappropriate_content', 'impersonation', 'violence_threat', 'other')
  );

ALTER TABLE public.group_reports
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'other';

ALTER TABLE public.group_reports DROP CONSTRAINT IF EXISTS group_reports_category_check;
ALTER TABLE public.group_reports
  ADD CONSTRAINT group_reports_category_check CHECK (
    category IN ('spam', 'harassment', 'inappropriate_content', 'impersonation', 'violence_threat', 'other')
  );

CREATE INDEX IF NOT EXISTS idx_reports_category ON public.reports(category);
CREATE INDEX IF NOT EXISTS idx_group_reports_category ON public.group_reports(category);
