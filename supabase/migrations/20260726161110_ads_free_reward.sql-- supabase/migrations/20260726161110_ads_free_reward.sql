-- supabase/migrations/20260726161110_ads_free_reward.sql

-- ============================================================
-- إعلانات الدردشة: عمود "دردشة بدون إعلانات" على البروفايل
-- ============================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS ad_free_until timestamptz;

-- تحديث الـ view العام عشان يظهر فيه ad_free_until — عشان الطوق
-- الذهبي حول الصورة يبان لأي مستخدم تاني بيشوف البروفايل ده، مش
-- بس صاحبه.
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
  ad_free_until
FROM public.profiles;

-- RPC آمنة (SECURITY DEFINER) لمنح مكافأة "دردشة بدون إعلانات"
-- لصاحب الحساب نفسه فقط (auth.uid())، بعد ما يشوف 5 إعلانات مكافأة
-- ورا بعض من واجهة إعدادات الدردشة. محدودة بـ 24 ساعة كحد أقصى في
-- المرة الواحدة كحماية بسيطة من إساءة الاستخدام.
CREATE OR REPLACE FUNCTION public.grant_ad_free_reward(_hours integer DEFAULT 12)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _me uuid := auth.uid();
  _new_until timestamptz;
BEGIN
  IF _me IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF _hours IS NULL OR _hours <= 0 OR _hours > 24 THEN
    RAISE EXCEPTION 'invalid hours';
  END IF;

  UPDATE public.profiles
  SET ad_free_until = GREATEST(COALESCE(ad_free_until, now()), now()) + make_interval(hours => _hours)
  WHERE user_id = _me
  RETURNING ad_free_until INTO _new_until;

  RETURN _new_until;
END;
$$;

GRANT EXECUTE ON FUNCTION public.grant_ad_free_reward(integer) TO authenticated;
