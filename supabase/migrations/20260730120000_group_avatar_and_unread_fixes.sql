-- ============================================================
-- FIX 1: صورة البروفايل الخاصة بالجروب بتختفي بعد الإنشاء
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_group_staff(_group_id uuid, _uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = _group_id AND user_id = _uid
      AND role IN ('owner','admin') AND status = 'active'
  );
$$;
REVOKE ALL ON FUNCTION public.is_group_staff(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_group_staff(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.handle_group_created()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.group_members(group_id, user_id, role, status)
  VALUES (NEW.id, NEW.owner_id, 'owner', 'active')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;
REVOKE EXECUTE ON FUNCTION public.handle_group_created() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_group_created ON public.groups;
CREATE TRIGGER trg_group_created AFTER INSERT ON public.groups
  FOR EACH ROW EXECUTE FUNCTION public.handle_group_created();

DROP POLICY IF EXISTS "group avatars: staff upload" ON storage.objects;
CREATE POLICY "group avatars: staff upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = 'groups'
    AND public.is_group_staff(((storage.foldername(name))[2])::uuid, auth.uid())
  );

DROP POLICY IF EXISTS "group avatars: staff update" ON storage.objects;
CREATE POLICY "group avatars: staff update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = 'groups'
    AND public.is_group_staff(((storage.foldername(name))[2])::uuid, auth.uid())
  );

DROP POLICY IF EXISTS "group avatars: staff delete" ON storage.objects;
CREATE POLICY "group avatars: staff delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = 'groups'
    AND public.is_group_staff(((storage.foldername(name))[2])::uuid, auth.uid())
  );

-- ============================================================
-- FIX 2: إشعار داخل التطبيق + آخر رسالة/وقتها للجروب
-- ============================================================

ALTER TABLE public.groups
  ADD COLUMN IF NOT EXISTS last_message_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_message_preview text;

CREATE OR REPLACE FUNCTION public.on_group_message_inserted()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.groups
    SET last_message_at = NEW.created_at,
        last_message_preview = LEFT(COALESCE(NEW.body, '📷 صورة'), 120)
    WHERE id = NEW.group_id;

  INSERT INTO public.notifications(user_id, type, payload)
  SELECT gm.user_id, 'group_message',
         jsonb_build_object('group_id', NEW.group_id, 'message_id', NEW.id, 'from', NEW.sender_id)
  FROM public.group_members gm
  WHERE gm.group_id = NEW.group_id
    AND gm.status = 'active'
    AND gm.user_id <> NEW.sender_id;
  RETURN NEW;
END; $$;
REVOKE EXECUTE ON FUNCTION public.on_group_message_inserted() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_on_group_message_inserted ON public.group_messages;
CREATE TRIGGER trg_on_group_message_inserted AFTER INSERT ON public.group_messages
  FOR EACH ROW EXECUTE FUNCTION public.on_group_message_inserted();
