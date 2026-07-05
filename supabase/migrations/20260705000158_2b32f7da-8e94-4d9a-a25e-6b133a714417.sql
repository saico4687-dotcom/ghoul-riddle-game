
-- Fix: friends can read minimal profile — drop policy exposing email/phone/address
DROP POLICY IF EXISTS "friends can read minimal profile" ON public.profiles;

-- Fix: messages update over-broad — restrict to recipient and lock updatable columns
DROP POLICY IF EXISTS "update own message read state" ON public.messages;
CREATE POLICY "recipient can update read/delivery state" ON public.messages
FOR UPDATE
USING (
  sender_id <> auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = messages.conversation_id
      AND (auth.uid() = c.user_a OR auth.uid() = c.user_b)
  )
)
WITH CHECK (
  sender_id <> auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = messages.conversation_id
      AND (auth.uid() = c.user_a OR auth.uid() = c.user_b)
  )
);

REVOKE UPDATE ON public.messages FROM anon, authenticated;
GRANT UPDATE (read_at, delivered_at) ON public.messages TO authenticated;

-- Fix: revoke EXECUTE from anon/authenticated on SECURITY DEFINER functions
-- not intended for direct client calls. Keep client-facing RPCs executable.
DO $$
DECLARE fn text;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure::text
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.prosecdef=true
      AND p.proname NOT IN (
        'search_users','get_or_create_conversation','mark_conversation_read',
        'set_username','presence_heartbeat'
      )
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn);
  END LOOP;
END $$;
