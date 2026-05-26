
-- 1) Remove competition_scores from Realtime publication to prevent any authenticated user
-- from subscribing to row-change events containing PII (phone/email/full_name).
ALTER PUBLICATION supabase_realtime DROP TABLE public.competition_scores;

-- 2) Lock down user_roles writes: only admins may insert/update/delete roles.
CREATE POLICY "Admins can insert roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 3) Revoke direct EXECUTE on the SECURITY DEFINER helper from API roles.
-- RLS policies invoke it internally via the table owner, so revoking from
-- anon/authenticated does not break access control checks.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, authenticated;
