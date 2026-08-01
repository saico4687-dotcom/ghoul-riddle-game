-- أرشفة/تثبيت الجروبات بالنسبة لكل عضو لوحده (زي واتساب بالظبط: تأثير
-- محلي على المستخدم اللي عمل الأرشفة، باقي الأعضاء مش متأثرين). العمودين
-- في group_members مش في groups، لأن كل صف في group_members أصلاً خاص
-- بعضو واحد، بعكس جدول conversations اللي احتجنا فيه array (archived_by)
-- عشان صف المحادثة مشترك بين طرفين.

ALTER TABLE public.group_members
  ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pinned boolean NOT NULL DEFAULT false;

-- المنحة عمودية (column-level) عمدًا: العضو العادي يقدر يعدّل حالة
-- الأرشفة/التثبيت بتاعته بس، من غير ما يقدر يغيّر role أو status بتاعه
-- (اللي بيتحكموا في صلاحياته جوه الجروب) عن طريق نفس الـ policy.
GRANT UPDATE (archived, pinned) ON public.group_members TO authenticated;

DROP POLICY IF EXISTS "members can archive/pin own membership" ON public.group_members;
CREATE POLICY "members can archive/pin own membership"
ON public.group_members
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
