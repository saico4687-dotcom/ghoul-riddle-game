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
  -- last_puzzle_index can now be updated by user for progress sync
  RETURN NEW;
END;
$function$;