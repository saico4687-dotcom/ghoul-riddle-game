
-- Privacy enum
DO $$ BEGIN
  CREATE TYPE public.chat_visibility AS ENUM ('everyone','friends','none');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Profiles: chat/social columns
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS bio text,
  ADD COLUMN IF NOT EXISTS username_changed_at timestamptz,
  ADD COLUMN IF NOT EXISTS privacy_last_seen public.chat_visibility NOT NULL DEFAULT 'friends',
  ADD COLUMN IF NOT EXISTS privacy_friend_requests public.chat_visibility NOT NULL DEFAULT 'everyone',
  ADD COLUMN IF NOT EXISTS privacy_messages public.chat_visibility NOT NULL DEFAULT 'friends';

GRANT UPDATE (bio, privacy_last_seen, privacy_friend_requests, privacy_messages)
  ON public.profiles TO authenticated;

-- Conversations pin/archive
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS pinned_by uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS archived_by uuid[] NOT NULL DEFAULT '{}';

-- Messages delivered_at
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz;

-- Presence heartbeat column (must exist before functions reference it)
ALTER TABLE public.user_presence
  ADD COLUMN IF NOT EXISTS last_beat timestamptz NOT NULL DEFAULT now();

-- Max 100 friends
CREATE OR REPLACE FUNCTION public.enforce_friends_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _c integer;
BEGIN
  SELECT count(*) INTO _c FROM public.friends WHERE user_id = NEW.user_id;
  IF _c >= 100 THEN RAISE EXCEPTION 'friends_limit_reached'; END IF;
  RETURN NEW;
END; $$;
REVOKE EXECUTE ON FUNCTION public.enforce_friends_limit() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_friends_limit ON public.friends;
CREATE TRIGGER trg_friends_limit BEFORE INSERT ON public.friends
  FOR EACH ROW EXECUTE FUNCTION public.enforce_friends_limit();

-- set_username: format validated client-side; server enforces length, uniqueness, and 30-day cooldown
CREATE OR REPLACE FUNCTION public.set_username(_new text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _prev citext; _changed timestamptz;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _new IS NULL OR char_length(_new) < 3 OR char_length(_new) > 20 THEN
    RAISE EXCEPTION 'invalid_length';
  END IF;
  -- Reject spaces / control chars / punctuation-like chars (allow letters incl. arabic, digits, underscore)
  IF _new ~ '[[:space:][:cntrl:]]' OR _new ~ '[!@#$%^&*()+={}\[\]|\\:;"''<>,.?/`~-]' THEN
    RAISE EXCEPTION 'invalid_format';
  END IF;
  SELECT username, username_changed_at INTO _prev, _changed
    FROM public.profiles WHERE user_id = _uid;
  IF _prev IS NOT NULL AND _changed IS NOT NULL AND _changed > now() - interval '30 days' THEN
    RAISE EXCEPTION 'change_cooldown';
  END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE username = _new::citext AND user_id <> _uid) THEN
    RAISE EXCEPTION 'username_taken';
  END IF;
  UPDATE public.profiles
    SET username = _new::citext,
        username_changed_at = CASE WHEN _prev IS NULL THEN username_changed_at ELSE now() END
    WHERE user_id = _uid;
END; $$;
REVOKE EXECUTE ON FUNCTION public.set_username(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_username(text) TO authenticated;

-- Public profile fetch (only safe columns; respects privacy + blocks)
CREATE OR REPLACE FUNCTION public.get_public_profile(_uid uuid)
RETURNS TABLE(
  user_id uuid,
  username citext,
  avatar_url text,
  bio text,
  riddles_completed_count integer,
  completed boolean,
  last_seen_at timestamptz,
  is_online boolean
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.user_id, p.username, p.avatar_url, p.bio,
         p.riddles_completed_count, p.completed,
         CASE
           WHEN p.privacy_last_seen = 'none' THEN NULL
           WHEN p.privacy_last_seen = 'friends'
                AND NOT public.are_friends(auth.uid(), p.user_id)
                AND auth.uid() <> p.user_id THEN NULL
           ELSE p.last_seen_at
         END AS last_seen_at,
         EXISTS(
           SELECT 1 FROM public.user_presence up
           WHERE up.user_id = p.user_id
             AND up.last_beat > now() - interval '90 seconds'
         ) AS is_online
  FROM public.profiles p
  WHERE p.user_id = _uid
    AND NOT public.is_blocked(auth.uid(), p.user_id);
$$;
REVOKE EXECUTE ON FUNCTION public.get_public_profile(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_public_profile(uuid) TO authenticated;

-- Allow authenticated users to read friends' minimal profile row for join queries
DROP POLICY IF EXISTS "friends can read minimal profile" ON public.profiles;
CREATE POLICY "friends can read minimal profile" ON public.profiles
FOR SELECT TO authenticated
USING (public.are_friends(auth.uid(), user_id));

-- Mark conversation as read by current user (other side)
CREATE OR REPLACE FUNCTION public.mark_conversation_read(_conversation_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RETURN; END IF;
  UPDATE public.messages
     SET read_at = COALESCE(read_at, now())
   WHERE conversation_id = _conversation_id
     AND sender_id <> _uid
     AND read_at IS NULL
     AND EXISTS (SELECT 1 FROM public.conversations c
                  WHERE c.id = _conversation_id
                    AND (_uid = c.user_a OR _uid = c.user_b));
END; $$;
REVOKE EXECUTE ON FUNCTION public.mark_conversation_read(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_conversation_read(uuid) TO authenticated;

-- Presence heartbeat
CREATE OR REPLACE FUNCTION public.presence_heartbeat()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RETURN; END IF;
  INSERT INTO public.user_presence(user_id, last_beat)
    VALUES (_uid, now())
    ON CONFLICT (user_id) DO UPDATE SET last_beat = now();
  UPDATE public.profiles SET last_seen_at = now() WHERE user_id = _uid;
END; $$;
REVOKE EXECUTE ON FUNCTION public.presence_heartbeat() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.presence_heartbeat() TO authenticated;

-- Realtime replica identity + publication
ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER TABLE public.friend_requests REPLICA IDENTITY FULL;
ALTER TABLE public.user_presence REPLICA IDENTITY FULL;
ALTER TABLE public.conversations REPLICA IDENTITY FULL;

DO $$ BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.messages; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.friend_requests; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.user_presence; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;
