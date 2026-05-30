-- Lock down profiles: browser may only update personal info, never score fields
REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (full_name, phone, address, email, name, profile_image, updated_at)
  ON public.profiles TO authenticated;

-- Lock down answer_times: only server (service_role) may insert
REVOKE INSERT ON public.answer_times FROM authenticated;
-- (SELECT policies remain so users can still read their own times)
