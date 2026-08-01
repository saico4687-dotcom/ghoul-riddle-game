-- جدول conversations كان عنده RLS مفعّل من غير أي policy لـ UPDATE، يعني أي
-- تحديث من الكلاينت (أرشفة/تثبيت/إعداد الرسائل المؤقتة) كان بيترفض بصمت.
-- السياسة دي بتسمح لأي طرف من طرفي المحادثة (user_a أو user_b) بتحديث صفّه فقط،
-- وبتمنعه من تغيير هوية أطراف المحادثة نفسها (user_a/user_b) عن طريق الـ WITH CHECK.

DROP POLICY IF EXISTS "participants can update own conversation" ON public.conversations;

CREATE POLICY "participants can update own conversation"
ON public.conversations
FOR UPDATE
TO authenticated
USING (auth.uid() = user_a OR auth.uid() = user_b)
WITH CHECK (auth.uid() = user_a OR auth.uid() = user_b);
