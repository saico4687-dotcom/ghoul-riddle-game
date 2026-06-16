
-- ============ EXTENSIONS ============
CREATE EXTENSION IF NOT EXISTS citext;

-- ============ PROFILES: add chat fields ============
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS username citext UNIQUE,
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_muted_until timestamptz,
  ADD COLUMN IF NOT EXISTS is_suspended_until timestamptz,
  ADD COLUMN IF NOT EXISTS riddles_completed_count integer NOT NULL DEFAULT 0;

UPDATE public.profiles
SET avatar_url = COALESCE(avatar_url, profile_image)
WHERE avatar_url IS NULL AND profile_image IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);

-- ============================================================
-- STEP 1: CREATE ALL TABLES (no policies yet)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.blocked_users (
  blocker_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);

CREATE TABLE IF NOT EXISTS public.friends (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  friend_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, friend_id),
  CHECK (user_id <> friend_id)
);

CREATE TABLE IF NOT EXISTS public.friend_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  to_user uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  UNIQUE(from_user, to_user),
  CHECK (from_user <> to_user)
);

CREATE TABLE IF NOT EXISTS public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_b uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_message_at timestamptz,
  last_message_preview text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_a, user_b),
  CHECK (user_a < user_b)
);

CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz,
  deleted_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.message_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji text NOT NULL CHECK (emoji IN ('👍','❤️','😂','😮')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(message_id, user_id, emoji)
);

CREATE TABLE IF NOT EXISTS public.user_presence (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'offline' CHECK (status IN ('online','offline')),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_message_id uuid REFERENCES public.messages(id) ON DELETE SET NULL,
  reason text NOT NULL CHECK (char_length(reason) BETWEEN 3 AND 500),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','dismissed','actioned')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.moderation_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  target_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('mute','suspend','unmute','unsuspend','dismiss','warn')),
  until timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- STEP 2: GRANTS
-- ============================================================
GRANT SELECT, INSERT, DELETE ON public.blocked_users TO authenticated;
GRANT ALL ON public.blocked_users TO service_role;

GRANT SELECT, INSERT, DELETE ON public.friends TO authenticated;
GRANT ALL ON public.friends TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.friend_requests TO authenticated;
GRANT ALL ON public.friend_requests TO service_role;

GRANT SELECT, INSERT, UPDATE ON public.conversations TO authenticated;
GRANT ALL ON public.conversations TO service_role;

GRANT SELECT, INSERT, UPDATE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;

GRANT SELECT, INSERT, DELETE ON public.message_reactions TO authenticated;
GRANT ALL ON public.message_reactions TO service_role;

GRANT SELECT, INSERT, UPDATE ON public.user_presence TO authenticated;
GRANT ALL ON public.user_presence TO service_role;

GRANT SELECT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

GRANT SELECT, INSERT, UPDATE ON public.reports TO authenticated;
GRANT ALL ON public.reports TO service_role;

GRANT SELECT, INSERT ON public.moderation_actions TO authenticated;
GRANT ALL ON public.moderation_actions TO service_role;

-- ============================================================
-- STEP 3: INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_messages_conv_created ON public.messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_reactions_msg ON public.message_reactions(message_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications(user_id, created_at DESC) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_reports_target ON public.reports(target_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_modactions_target ON public.moderation_actions(target_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_user_a ON public.conversations(user_a, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_user_b ON public.conversations(user_b, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_friends_user ON public.friends(user_id);
CREATE INDEX IF NOT EXISTS idx_blocked_blocker ON public.blocked_users(blocker_id);
CREATE INDEX IF NOT EXISTS idx_freq_to ON public.friend_requests(to_user, status);
CREATE INDEX IF NOT EXISTS idx_freq_from ON public.friend_requests(from_user, status);

-- ============================================================
-- STEP 4: HELPER FUNCTIONS (now that all tables exist)
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_blocked(_a uuid, _b uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.blocked_users
    WHERE (blocker_id = _a AND blocked_id = _b) OR (blocker_id = _b AND blocked_id = _a)
  );
$$;

CREATE OR REPLACE FUNCTION public.are_friends(_a uuid, _b uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.friends WHERE user_id = _a AND friend_id = _b);
$$;

CREATE OR REPLACE FUNCTION public.has_completed_400(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = _uid AND completed = true);
$$;

CREATE OR REPLACE FUNCTION public.is_active_user(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = _uid
      AND ((is_muted_until IS NOT NULL AND is_muted_until > now())
           OR (is_suspended_until IS NOT NULL AND is_suspended_until > now()))
  );
$$;

-- ============================================================
-- STEP 5: PUBLIC PROFILES VIEW (no email)
-- ============================================================
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
  is_suspended_until
FROM public.profiles;
GRANT SELECT ON public.public_profiles TO authenticated;

-- ============================================================
-- STEP 6: ENABLE RLS + POLICIES
-- ============================================================

-- blocked_users
ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "see own blocks" ON public.blocked_users;
DROP POLICY IF EXISTS "create own block" ON public.blocked_users;
DROP POLICY IF EXISTS "remove own block" ON public.blocked_users;
CREATE POLICY "see own blocks" ON public.blocked_users FOR SELECT TO authenticated USING (auth.uid() = blocker_id);
CREATE POLICY "create own block" ON public.blocked_users FOR INSERT TO authenticated WITH CHECK (auth.uid() = blocker_id);
CREATE POLICY "remove own block" ON public.blocked_users FOR DELETE TO authenticated USING (auth.uid() = blocker_id);

-- friends
ALTER TABLE public.friends ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "see own friends" ON public.friends;
DROP POLICY IF EXISTS "remove own friend" ON public.friends;
CREATE POLICY "see own friends" ON public.friends FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "remove own friend" ON public.friends FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- friend_requests
ALTER TABLE public.friend_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "see own requests" ON public.friend_requests;
DROP POLICY IF EXISTS "send requests" ON public.friend_requests;
DROP POLICY IF EXISTS "respond to requests" ON public.friend_requests;
DROP POLICY IF EXISTS "delete own request" ON public.friend_requests;
CREATE POLICY "see own requests" ON public.friend_requests FOR SELECT TO authenticated
  USING (auth.uid() = from_user OR auth.uid() = to_user);
CREATE POLICY "send requests" ON public.friend_requests FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = from_user
    AND NOT public.is_blocked(from_user, to_user)
    AND public.has_completed_400(from_user)
    AND public.has_completed_400(to_user)
    AND public.is_active_user(from_user)
  );
CREATE POLICY "respond to requests" ON public.friend_requests FOR UPDATE TO authenticated
  USING (auth.uid() = to_user OR auth.uid() = from_user)
  WITH CHECK (auth.uid() = to_user OR auth.uid() = from_user);
CREATE POLICY "delete own request" ON public.friend_requests FOR DELETE TO authenticated
  USING (auth.uid() = from_user OR auth.uid() = to_user);

-- conversations
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "see own convo" ON public.conversations;
DROP POLICY IF EXISTS "create convo as participant" ON public.conversations;
CREATE POLICY "see own convo" ON public.conversations FOR SELECT TO authenticated
  USING (auth.uid() = user_a OR auth.uid() = user_b);
CREATE POLICY "create convo as participant" ON public.conversations FOR INSERT TO authenticated
  WITH CHECK (
    (auth.uid() = user_a OR auth.uid() = user_b)
    AND NOT public.is_blocked(user_a, user_b)
    AND public.has_completed_400(user_a)
    AND public.has_completed_400(user_b)
  );

-- messages
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "see messages in own convos" ON public.messages;
DROP POLICY IF EXISTS "send message in own convo" ON public.messages;
DROP POLICY IF EXISTS "update own message read state" ON public.messages;
CREATE POLICY "see messages in own convos" ON public.messages FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = conversation_id AND (auth.uid() = c.user_a OR auth.uid() = c.user_b)));
CREATE POLICY "send message in own convo" ON public.messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND public.is_active_user(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id
        AND (auth.uid() = c.user_a OR auth.uid() = c.user_b)
        AND NOT public.is_blocked(c.user_a, c.user_b)
        AND public.has_completed_400(c.user_a)
        AND public.has_completed_400(c.user_b)
    )
  );
CREATE POLICY "update own message read state" ON public.messages FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = conversation_id AND (auth.uid() = c.user_a OR auth.uid() = c.user_b)));

-- message_reactions
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "see reactions in own convos" ON public.message_reactions;
DROP POLICY IF EXISTS "react in own convos" ON public.message_reactions;
DROP POLICY IF EXISTS "unreact own" ON public.message_reactions;
CREATE POLICY "see reactions in own convos" ON public.message_reactions FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.messages m
    JOIN public.conversations c ON c.id = m.conversation_id
    WHERE m.id = message_id AND (auth.uid() = c.user_a OR auth.uid() = c.user_b)
  ));
CREATE POLICY "react in own convos" ON public.message_reactions FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.messages m
      JOIN public.conversations c ON c.id = m.conversation_id
      WHERE m.id = message_id AND (auth.uid() = c.user_a OR auth.uid() = c.user_b)
    )
  );
CREATE POLICY "unreact own" ON public.message_reactions FOR DELETE TO authenticated USING (user_id = auth.uid());

-- user_presence
ALTER TABLE public.user_presence ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "presence readable by authenticated" ON public.user_presence;
DROP POLICY IF EXISTS "upsert own presence" ON public.user_presence;
DROP POLICY IF EXISTS "update own presence" ON public.user_presence;
CREATE POLICY "presence readable by authenticated" ON public.user_presence FOR SELECT TO authenticated USING (true);
CREATE POLICY "upsert own presence" ON public.user_presence FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "update own presence" ON public.user_presence FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "see own notifications" ON public.notifications;
DROP POLICY IF EXISTS "mark own notification read" ON public.notifications;
DROP POLICY IF EXISTS "delete own notification" ON public.notifications;
CREATE POLICY "see own notifications" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "mark own notification read" ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "delete own notification" ON public.notifications FOR DELETE TO authenticated USING (user_id = auth.uid());

-- reports
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "submit report" ON public.reports;
DROP POLICY IF EXISTS "see own reports" ON public.reports;
DROP POLICY IF EXISTS "admins update reports" ON public.reports;
CREATE POLICY "submit report" ON public.reports FOR INSERT TO authenticated
  WITH CHECK (reporter_id = auth.uid() AND reporter_id <> target_user_id);
CREATE POLICY "see own reports" ON public.reports FOR SELECT TO authenticated
  USING (reporter_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins update reports" ON public.reports FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- moderation_actions
ALTER TABLE public.moderation_actions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admins see modactions" ON public.moderation_actions;
DROP POLICY IF EXISTS "admins create modactions" ON public.moderation_actions;
CREATE POLICY "admins see modactions" ON public.moderation_actions FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins create modactions" ON public.moderation_actions FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') AND admin_id = auth.uid());

-- ============================================================
-- STEP 7: RPCs
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_or_create_conversation(_other uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _me uuid := auth.uid(); _a uuid; _b uuid; _id uuid;
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _me = _other THEN RAISE EXCEPTION 'cannot chat with self'; END IF;
  IF public.is_blocked(_me, _other) THEN RAISE EXCEPTION 'blocked'; END IF;
  IF NOT public.has_completed_400(_me) OR NOT public.has_completed_400(_other) THEN
    RAISE EXCEPTION 'both users must complete 400 riddles';
  END IF;
  IF _me < _other THEN _a := _me; _b := _other; ELSE _a := _other; _b := _me; END IF;
  SELECT id INTO _id FROM public.conversations WHERE user_a = _a AND user_b = _b;
  IF _id IS NULL THEN
    INSERT INTO public.conversations(user_a, user_b) VALUES (_a, _b) RETURNING id INTO _id;
  END IF;
  RETURN _id;
END; $$;
GRANT EXECUTE ON FUNCTION public.get_or_create_conversation(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.search_users(_q text)
RETURNS TABLE(user_id uuid, username citext, avatar_url text, riddles_completed int, last_seen_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.user_id, p.username, p.avatar_url,
         CASE WHEN p.completed THEN 400 ELSE COALESCE(p.last_puzzle_index,0) END,
         p.last_seen_at
  FROM public.profiles p
  WHERE p.username IS NOT NULL
    AND p.username ILIKE '%' || _q || '%'
    AND p.user_id <> auth.uid()
    AND NOT public.is_blocked(auth.uid(), p.user_id)
  ORDER BY p.username
  LIMIT 30;
$$;
GRANT EXECUTE ON FUNCTION public.search_users(text) TO authenticated;

-- ============================================================
-- STEP 8: TRIGGERS
-- ============================================================

-- accept friend_request -> insert mirrored friends + notify
CREATE OR REPLACE FUNCTION public.handle_friend_request_accepted()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'accepted' AND (OLD.status IS DISTINCT FROM 'accepted') THEN
    INSERT INTO public.friends(user_id, friend_id) VALUES (NEW.from_user, NEW.to_user) ON CONFLICT DO NOTHING;
    INSERT INTO public.friends(user_id, friend_id) VALUES (NEW.to_user, NEW.from_user) ON CONFLICT DO NOTHING;
    NEW.responded_at := now();
    INSERT INTO public.notifications(user_id, type, payload) VALUES
      (NEW.from_user, 'friend_accepted', jsonb_build_object('by', NEW.to_user)),
      (NEW.to_user,   'friend_accepted', jsonb_build_object('with', NEW.from_user));
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_friend_request_accepted ON public.friend_requests;
CREATE TRIGGER trg_friend_request_accepted BEFORE UPDATE ON public.friend_requests
  FOR EACH ROW EXECUTE FUNCTION public.handle_friend_request_accepted();

CREATE OR REPLACE FUNCTION public.notify_friend_request()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.notifications(user_id, type, payload)
  VALUES (NEW.to_user, 'friend_request', jsonb_build_object('from', NEW.from_user, 'request_id', NEW.id));
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_notify_friend_request ON public.friend_requests;
CREATE TRIGGER trg_notify_friend_request AFTER INSERT ON public.friend_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_friend_request();

-- on block: remove friendship + pending requests
CREATE OR REPLACE FUNCTION public.on_block_cleanup()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM public.friends WHERE (user_id = NEW.blocker_id AND friend_id = NEW.blocked_id) OR (user_id = NEW.blocked_id AND friend_id = NEW.blocker_id);
  DELETE FROM public.friend_requests
    WHERE status = 'pending'
      AND ((from_user = NEW.blocker_id AND to_user = NEW.blocked_id) OR (from_user = NEW.blocked_id AND to_user = NEW.blocker_id));
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_on_block_cleanup ON public.blocked_users;
CREATE TRIGGER trg_on_block_cleanup AFTER INSERT ON public.blocked_users
  FOR EACH ROW EXECUTE FUNCTION public.on_block_cleanup();

-- on message insert: update conv preview + notify recipient
CREATE OR REPLACE FUNCTION public.on_message_inserted()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _other uuid; _c record;
BEGIN
  SELECT * INTO _c FROM public.conversations WHERE id = NEW.conversation_id;
  UPDATE public.conversations
    SET last_message_at = NEW.created_at, last_message_preview = LEFT(NEW.body, 120)
    WHERE id = NEW.conversation_id;
  IF NEW.sender_id = _c.user_a THEN _other := _c.user_b; ELSE _other := _c.user_a; END IF;
  INSERT INTO public.notifications(user_id, type, payload)
    VALUES (_other, 'new_message', jsonb_build_object('conversation_id', NEW.conversation_id, 'message_id', NEW.id, 'from', NEW.sender_id));
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_on_message_inserted ON public.messages;
CREATE TRIGGER trg_on_message_inserted AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.on_message_inserted();

-- auto moderation
CREATE OR REPLACE FUNCTION public.auto_moderate_on_report()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _count integer;
BEGIN
  SELECT COUNT(*) INTO _count FROM public.reports
   WHERE target_user_id = NEW.target_user_id
     AND created_at > now() - interval '24 hours'
     AND status = 'open';
  IF _count >= 5 THEN
    UPDATE public.profiles SET is_suspended_until = now() + interval '7 days' WHERE user_id = NEW.target_user_id;
    INSERT INTO public.moderation_actions(admin_id, target_user_id, action, until, notes)
    VALUES (NULL, NEW.target_user_id, 'suspend', now() + interval '7 days', 'auto: 5+ reports/24h');
  ELSIF _count >= 3 THEN
    UPDATE public.profiles SET is_muted_until = GREATEST(COALESCE(is_muted_until, now()), now() + interval '24 hours') WHERE user_id = NEW.target_user_id;
    INSERT INTO public.moderation_actions(admin_id, target_user_id, action, until, notes)
    VALUES (NULL, NEW.target_user_id, 'mute', now() + interval '24 hours', 'auto: 3+ reports/24h');
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_auto_moderate ON public.reports;
CREATE TRIGGER trg_auto_moderate AFTER INSERT ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.auto_moderate_on_report();

-- presence updated_at
DROP TRIGGER IF EXISTS trg_presence_updated_at ON public.user_presence;
CREATE TRIGGER trg_presence_updated_at BEFORE UPDATE ON public.user_presence
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- STEP 9: REALTIME PUBLICATION + REPLICA IDENTITY
-- ============================================================
DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.messages; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.user_presence; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.friend_requests; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER TABLE public.message_reactions REPLICA IDENTITY FULL;
ALTER TABLE public.user_presence REPLICA IDENTITY FULL;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER TABLE public.conversations REPLICA IDENTITY FULL;
