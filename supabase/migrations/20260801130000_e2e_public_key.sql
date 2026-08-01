-- تشفير طرف لطرف (E2E) للرسائل النصية في المحادثات الفردية:
-- كل مستخدم بيولّد زوج مفاتيح ECDH (P-256) على جهازه، المفتاح الخاص
-- بيفضل على الجهاز بس (localStorage) ومايتبعتش للسيرفر أبدًا، والمفتاح
-- العام بس هو اللي بيتخزن هنا عشان الطرف التاني يقدر يشتق نفس المفتاح
-- المشترك (Shared Secret) ويشفّر/يفكّ بيه. السيرفر مايملكش القدرة على
-- فك التشفير لإنه ملوش وصول للمفتاح الخاص لأي طرف.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS public_key text;

-- المستخدم يقدر يحدّث مفتاحه العام بس (زي باقي أعمدة profiles اللي
-- متاحة للتحديث الذاتي — الـ GRANT هنا عمودي/column-level زي النمط
-- الموجود فعلاً في fix_profiles_update_grant.sql).
GRANT UPDATE (public_key) ON public.profiles TO authenticated;

-- إظهار المفتاح العام في الـ view العام عشان أي طرف في محادثة يقدر
-- يجيب مفتاح الطرف التاني ويشتق المفتاح المشترك.
CREATE OR REPLACE VIEW public.public_profiles
WITH (security_invoker=on) AS
SELECT
  user_id,
  username,
  avatar_url,
  created_at AS joined_at,
  CASE WHEN completed THEN 400 ELSE COALESCE(last_puzzle_index, 0) END AS riddles_completed,
  completed,
  last_seen_at,
  is_muted_until,
  is_suspended_until,
  ad_free_until,
  public_key
FROM public.profiles;
