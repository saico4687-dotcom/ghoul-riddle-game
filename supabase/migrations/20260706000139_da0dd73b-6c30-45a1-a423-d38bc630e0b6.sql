
-- Restrict messages update policy to authenticated role only
DROP POLICY IF EXISTS "recipient can update read/delivery state" ON public.messages;
CREATE POLICY "recipient can update read/delivery state"
ON public.messages
FOR UPDATE
TO authenticated
USING (
  auth.uid() <> sender_id
  AND EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = messages.conversation_id
      AND (auth.uid() = c.user_a OR auth.uid() = c.user_b)
  )
)
WITH CHECK (
  auth.uid() <> sender_id
  AND EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = messages.conversation_id
      AND (auth.uid() = c.user_a OR auth.uid() = c.user_b)
  )
);

-- Explicit INSERT policy for competition_scores: user may insert only their own row.
-- Score/point fields are protected by prevent_profile_score_tampering triggers where applicable;
-- server-side edge functions using service_role bypass RLS.
CREATE POLICY "users can insert own competition score"
ON public.competition_scores
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);
