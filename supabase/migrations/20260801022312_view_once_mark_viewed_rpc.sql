-- ===== "شاهدها مرة واحدة" (View Once) — يسجّل أول فتح فقط ويمنع أي فتح بعده =====
-- بيرجع true لو ده أول فتح فعلي (يبقى للفرونت يعرض المحتوى)، و false لو
-- كانت اتفتحت قبل كده (يبقى يعرض "تم استعراضها بالفعل" بدل المحتوى).

create or replace function public.mark_message_view_once(_message_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  _sender uuid;
  _conv uuid;
  _view_once boolean;
  _won boolean;
begin
  select sender_id, conversation_id, view_once into _sender, _conv, _view_once
  from public.messages where id = _message_id;

  if _conv is null then
    raise exception 'message_not_found';
  end if;
  if not exists (
    select 1 from public.conversation_participants
    where conversation_id = _conv and user_id = auth.uid()
  ) then
    raise exception 'not_authorized';
  end if;
  if not _view_once then
    -- مش رسالة View Once أصلاً — منسمحش نستخدم الميكانيزم ده عليها
    return true;
  end if;
  if auth.uid() = _sender then
    -- المرسل يقدر يشوفها زي ما هي دايمًا، من غير ما يستهلك الاستعراض
    return true;
  end if;

  update public.messages
  set viewed_at = now()
  where id = _message_id and viewed_at is null
  returning true into _won;

  return coalesce(_won, false);
end;
$$;
revoke all on function public.mark_message_view_once(uuid) from public, anon;
grant execute on function public.mark_message_view_once(uuid) to authenticated;

create or replace function public.mark_group_message_view_once(_message_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  _sender uuid;
  _group uuid;
  _view_once boolean;
  _won boolean;
begin
  select sender_id, group_id, view_once into _sender, _group, _view_once
  from public.group_messages where id = _message_id;

  if _group is null then
    raise exception 'message_not_found';
  end if;
  if not exists (
    select 1 from public.group_members
    where group_id = _group and user_id = auth.uid() and status = 'active'
  ) then
    raise exception 'not_authorized';
  end if;
  if not _view_once then
    return true;
  end if;
  if auth.uid() = _sender then
    return true;
  end if;

  -- في الجروب: أول عضو يفتحها بيستهلك الاستعراض للكل (نفس منطق التخزين
  -- المؤقت المشترك للوسائط أصلاً في الجروب).
  update public.group_messages
  set viewed_at = now()
  where id = _message_id and viewed_at is null
  returning true into _won;

  return coalesce(_won, false);
end;
$$;
revoke all on function public.mark_group_message_view_once(uuid) from public, anon;
grant execute on function public.mark_group_message_view_once(uuid) to authenticated;
