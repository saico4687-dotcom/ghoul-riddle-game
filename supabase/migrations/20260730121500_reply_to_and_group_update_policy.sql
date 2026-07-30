-- ============================================================
-- FIX 1: خاصية "الرد على رسالة" (سحب/شد الرسالة زي واتساب) —
-- محتاجين عمود reply_to_id في الرسائل الخاصة ورسائل الجروبات
-- ============================================================

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS reply_to_id uuid REFERENCES public.messages(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_messages_reply_to_id ON public.messages(reply_to_id);

ALTER TABLE public.group_messages
  ADD COLUMN IF NOT EXISTS reply_to_id uuid REFERENCES public.group_messages(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_group_messages_reply_to_id ON public.group_messages(reply_to_id);

-- ============================================================
-- FIX 2: تعديل بيانات الجروب (الاسم/الوصف/الصورة) بعد الإنشاء
-- كان ممكن يفشل بصمت لو مفيش UPDATE policy صريحة للمشرفين/المالك
-- على جدول groups نفسه (بعكس صورة الرفع في storage.objects اللي
-- كانت متغطية من قبل) — فبنضيف policy واضحة هنا.
-- ============================================================

DROP POLICY IF EXISTS "groups: staff update" ON public.groups;
CREATE POLICY "groups: staff update" ON public.groups
  FOR UPDATE TO authenticated
  USING (public.is_group_staff(id, auth.uid()))
  WITH CHECK (public.is_group_staff(id, auth.uid()));
