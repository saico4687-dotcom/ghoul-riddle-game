-- ===== حد أقصى لأعضاء الجروب (زي واتساب: 1024 عضو) =====
alter table public.groups
  add column if not exists max_members integer not null default 1024;

alter table public.groups
  add constraint groups_max_members_check check (max_members > 0 and max_members <= 1024);

create or replace function public.join_group_by_invite(_invite_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  _group_id uuid;
  _max int;
  _current_count int;
begin
  select id, max_members into _group_id, _max
  from public.groups where invite_code = _invite_code and invite_enabled = true;

  if _group_id is null then
    raise exception 'invalid_invite_code';
  end if;
  if public.is_group_banned(_group_id, auth.uid()) then
    raise exception 'banned_from_group';
  end if;

  select count(*) into _current_count
  from public.group_members
  where group_id = _group_id and status = 'active';

  -- لو العضو أصلاً عضو فعّال، منمنعوش (إعادة انضمام). المنع بس للأعضاء الجداد.
  if _current_count >= _max and not exists (
    select 1 from public.group_members
    where group_id = _group_id and user_id = auth.uid() and status = 'active'
  ) then
    raise exception 'group_full';
  end if;

  insert into public.group_members(group_id, user_id, role, status)
  values (_group_id, auth.uid(), 'member', 'active')
  on conflict (group_id, user_id) do update set status = 'active';
  insert into public.group_messages(group_id, sender_id, system_event)
  values (_group_id, auth.uid(), 'joined');
  return _group_id;
end;
$$;
revoke all on function public.join_group_by_invite(text) from public, anon;
grant execute on function public.join_group_by_invite(text) to authenticated;
