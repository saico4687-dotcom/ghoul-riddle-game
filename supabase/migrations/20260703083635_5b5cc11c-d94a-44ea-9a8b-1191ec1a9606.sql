
-- 1) answer_times: allow users to insert their own rows
CREATE POLICY "Users insert own answer times"
  ON public.answer_times
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 2) friend_requests: only recipient can update (accept/decline); allow either party to delete via existing DELETE policy
DROP POLICY IF EXISTS "respond to requests" ON public.friend_requests;
CREATE POLICY "recipient responds to requests"
  ON public.friend_requests
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = to_user)
  WITH CHECK (auth.uid() = to_user);

-- 3) profiles: column-level UPDATE — prevent clients from writing score/completion fields
REVOKE UPDATE ON public.profiles FROM anon, authenticated;
GRANT UPDATE (
  email, name, profile_image, last_puzzle_index, full_name, phone, address,
  total_time_ms, username, avatar_url, last_seen_at, riddles_completed_count
) ON public.profiles TO authenticated;

-- 4) has_role: SECURITY DEFINER with fixed search_path
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- 5) Revoke EXECUTE on internal trigger functions from public roles
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_friend_request() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.on_block_cleanup() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.on_message_inserted() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_moderate_on_report() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_friend_request_accepted() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_profile_score_tampering() FROM PUBLIC, anon, authenticated;
