
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS completed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS total_time_ms bigint NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.prevent_profile_score_tampering()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;
  -- Score fields remain server-managed (anti-cheat)
  NEW.saved_score        := OLD.saved_score;
  NEW.saved_total_points := OLD.saved_total_points;
  NEW.saved_time_bonus   := OLD.saved_time_bonus;
  -- Once completed = true, it cannot be reverted by the user
  IF OLD.completed = true THEN
    NEW.completed := true;
    NEW.completed_at := OLD.completed_at;
  END IF;
  RETURN NEW;
END;
$function$;
