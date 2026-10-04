-- ساعة السيرفر لكل لغز + حذف الإجابتين + نتيجة الإجابة (عشان الإعادة تبقى آمنة).
-- محدش من الموبايل يقدر يقرا أو يكتب فيها — الدالة submit-answer بس (service_role).
CREATE TABLE IF NOT EXISTS public.riddle_starts (
  user_id       uuid        NOT NULL,
  riddle_index  integer     NOT NULL,
  started_at    timestamptz NOT NULL DEFAULT now(),
  answered_at   timestamptz,
  fifty_removed jsonb,
  result        jsonb,
  PRIMARY KEY (user_id, riddle_index)
);

ALTER TABLE public.riddle_starts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.riddle_starts FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.riddle_starts TO service_role;

-- جدول الأوقات: القراءة بس للمستخدم (صفوفه هو) وللأدمن.
-- الكتابة من السيرفر بس. بنشيل السياسة القديمة اللي كانت بتوحي
-- إن المستخدم يقدر يكتب (الصلاحية كانت مسحوبة أصلًا، فمكانتش بتشتغل).
DROP POLICY IF EXISTS "Users insert own answer times" ON public.answer_times;
REVOKE ALL ON public.answer_times FROM anon, authenticated;
GRANT SELECT ON public.answer_times TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.answer_times TO service_role;
