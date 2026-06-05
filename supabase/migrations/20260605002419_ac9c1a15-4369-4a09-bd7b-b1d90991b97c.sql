
-- Lock down competition_scores: clients cannot write at all. Only service_role (edge functions) may write.
DROP POLICY IF EXISTS "Users can insert own score" ON public.competition_scores;
DROP POLICY IF EXISTS "Users can update own score" ON public.competition_scores;
REVOKE INSERT, UPDATE, DELETE ON public.competition_scores FROM authenticated;

-- Protect score columns on profiles via trigger: prevent users from tampering with server-managed fields.
CREATE OR REPLACE FUNCTION public.prevent_profile_score_tampering()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- service_role bypasses this check (edge functions use it)
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- For all other roles, preserve server-managed values
  NEW.saved_score        := OLD.saved_score;
  NEW.saved_total_points := OLD.saved_total_points;
  NEW.saved_time_bonus   := OLD.saved_time_bonus;
  NEW.last_puzzle_index  := OLD.last_puzzle_index;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_profile_score_tampering ON public.profiles;
CREATE TRIGGER trg_prevent_profile_score_tampering
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_profile_score_tampering();
