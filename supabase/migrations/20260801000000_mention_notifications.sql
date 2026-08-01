-- ===== إشعار المستخدم لما يتعمله منشن @username داخل رسالة فردية أو جروب =====
-- الإدراج في notifications ممنوع على العميل مباشرة (مفيش INSERT policy)،
-- فلازم يتم عن طريق trigger بصلاحية SECURITY DEFINER زي باقي إشعارات
-- التطبيق (friend_request, new_message...).

CREATE OR REPLACE FUNCTION public.notify_message_mention()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _group_id uuid;
  _conversation_id uuid;
  _sender uuid;
BEGIN
  -- تجاهل لو المستخدم عمل منشن لنفسه
  IF NEW.group_message_id IS NOT NULL THEN
    SELECT group_id, sender_id INTO _group_id, _sender
      FROM public.group_messages WHERE id = NEW.group_message_id;

    IF _sender IS DISTINCT FROM NEW.mentioned_user_id THEN
      INSERT INTO public.notifications(user_id, type, payload)
      VALUES (
        NEW.mentioned_user_id,
        'mention',
        jsonb_build_object(
          'group_id', _group_id,
          'group_message_id', NEW.group_message_id,
          'from', _sender
        )
      );
    END IF;
  ELSIF NEW.message_id IS NOT NULL THEN
    SELECT conversation_id, sender_id INTO _conversation_id, _sender
      FROM public.messages WHERE id = NEW.message_id;

    IF _sender IS DISTINCT FROM NEW.mentioned_user_id THEN
      INSERT INTO public.notifications(user_id, type, payload)
      VALUES (
        NEW.mentioned_user_id,
        'mention',
        jsonb_build_object(
          'conversation_id', _conversation_id,
          'message_id', NEW.message_id,
          'from', _sender
        )
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_message_mention ON public.message_mentions;
CREATE TRIGGER trg_notify_message_mention
  AFTER INSERT ON public.message_mentions
  FOR EACH ROW EXECUTE FUNCTION public.notify_message_mention();
