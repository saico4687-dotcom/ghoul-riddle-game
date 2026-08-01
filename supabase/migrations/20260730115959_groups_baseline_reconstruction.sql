-- ============================================================
-- ⚠️ ملاحظة مهمة: ده migration "إعادة بناء" (reconstruction) —
-- مش تصدير حقيقي من قاعدة البيانات. اكتشفنا إن جداول ودوال
-- الجروبات كلها (groups, group_members, group_messages,
-- group_reports + ~14 دالة RPC زي join_group_by_invite،
-- ban_group_member، إلخ) موجودة في قاعدة البيانات الحية فعلاً
-- (ظاهرة في src/integrations/supabase/types.ts) لكن مش موجودة
-- في أي ملف migration في المشروع. يعني لو حد شغّل المشروع من
-- الصفر على مشروع Supabase جديد، ميزة الجروبات كلها هتفشل من
-- أول استعلام لأن الجداول مش موجودة.
--
-- بنيت الملف ده بالاعتماد على شكل الأعمدة الموجود في types.ts
-- وأسماء الدوال وتوقيعاتها (لكن مش أجسام الدوال الفعلية، لأنها
-- مش موجودة في أي مكان في المشروع المُصدَّر). المنطق جوه كل دالة
-- هنا مبني على السلوك المتوقع من استخدامها في الكود
-- (groupQueries.ts) وعلى نفس الأسلوب المستخدم في باقي الملفات.
--
-- ⚠️ لازم قبل ما تشغّل الملف ده على أي بيئة فيها قاعدة بيانات
-- حية بالفعل (staging/production) إنك تتأكد إن الجداول والدوال
-- دي مش موجودة أصلاً (كل الأوامر هنا IF NOT EXISTS / OR REPLACE
-- فهي آمنة تقنيًا)، لكن لو جسم أي دالة هنا مختلف عن اللي شغال
-- عندك فعليًا (خصوصًا منطق الحظر/الأدمن)، الـ OR REPLACE هيغيّر
-- السلوك الفعلي. الأنسب إنك تشغّله بس على قاعدة بيانات جديدة
-- فاضية، أو تراجعه سطر سطر قبل ما تطبّقه فوق بيانات حقيقية.
-- ============================================================

do $$ begin
  create type public.group_role as enum ('owner', 'admin', 'member');
exception when duplicate_object then null; end $$;

-- ===== الجداول =====

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  avatar_url text,
  owner_id uuid not null references auth.users(id) on delete cascade,
  lock_chat boolean not null default false,
  invite_code text not null unique default substr(md5(random()::text), 1, 8),
  invite_enabled boolean not null default true,
  pinned_message_id uuid,
  pinned_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.group_members (
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.group_role not null default 'member',
  status text not null default 'active',
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create table if not exists public.group_messages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text,
  image_url text,
  reply_to_id uuid references public.group_messages(id) on delete set null,
  system_event text,
  read_at timestamptz,
  deleted_at timestamptz,
  -- تخزين مؤقت مشفّر للوسائط (نفس مبدأ الرسائل الفردية) — العمود
  -- بيتصفّر أول ما الملف يتمسح من الـ storage (استلام أو انتهاء TTL)
  media_path text,
  media_type text,
  media_mime text,
  media_size_bytes bigint,
  media_duration_seconds integer,
  media_iv text,
  media_key text,
  media_expires_at timestamptz,
  media_deleted_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.group_reports (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  target_user_id uuid references auth.users(id) on delete set null,
  target_message_id uuid references public.group_messages(id) on delete set null,
  reason text not null,
  status text not null default 'open',
  created_at timestamptz not null default now()
);

create index if not exists idx_group_members_user on public.group_members(user_id);
create index if not exists idx_group_messages_group_created on public.group_messages(group_id, created_at);

alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.group_messages enable row level security;
alter table public.group_reports enable row level security;

-- ===== دوال مساعدة (helper functions) =====

create or replace function public.is_group_member(_group_id uuid, _user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.group_members
    where group_id = _group_id and user_id = _user_id and status = 'active'
  );
$$;
revoke all on function public.is_group_member(uuid, uuid) from public, anon;
grant execute on function public.is_group_member(uuid, uuid) to authenticated;

create or replace function public.is_group_owner(_group_id uuid, _user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.groups where id = _group_id and owner_id = _user_id);
$$;
revoke all on function public.is_group_owner(uuid, uuid) from public, anon;
grant execute on function public.is_group_owner(uuid, uuid) to authenticated;

create or replace function public.is_group_banned(_group_id uuid, _user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.group_members
    where group_id = _group_id and user_id = _user_id and status = 'banned'
  );
$$;
revoke all on function public.is_group_banned(uuid, uuid) from public, anon;
grant execute on function public.is_group_banned(uuid, uuid) to authenticated;

create or replace function public.can_post_in_group(_group_id uuid, _user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.group_members gm
    join public.groups g on g.id = gm.group_id
    where gm.group_id = _group_id and gm.user_id = _user_id and gm.status = 'active'
      and (g.lock_chat = false or gm.role in ('owner','admin'))
  );
$$;
revoke all on function public.can_post_in_group(uuid, uuid) from public, anon;
grant execute on function public.can_post_in_group(uuid, uuid) to authenticated;

create or replace function public.get_group_role(_group_id uuid, _user_id uuid)
returns public.group_role language sql stable security definer set search_path = public as $$
  select role from public.group_members where group_id = _group_id and user_id = _user_id;
$$;
revoke all on function public.get_group_role(uuid, uuid) from public, anon;
grant execute on function public.get_group_role(uuid, uuid) to authenticated;

-- ===== دوال RPC =====

create or replace function public.join_group_by_invite(_invite_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  _group_id uuid;
begin
  select id into _group_id from public.groups where invite_code = _invite_code and invite_enabled = true;
  if _group_id is null then
    raise exception 'invalid_invite_code';
  end if;
  if public.is_group_banned(_group_id, auth.uid()) then
    raise exception 'banned_from_group';
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

create or replace function public.leave_group(_group_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.group_members set status = 'left' where group_id = _group_id and user_id = auth.uid();
  insert into public.group_messages(group_id, sender_id, system_event)
  values (_group_id, auth.uid(), 'left');
end;
$$;
revoke all on function public.leave_group(uuid) from public, anon;
grant execute on function public.leave_group(uuid) to authenticated;

create or replace function public.ban_group_member(_group_id uuid, _target_user uuid, _reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_group_staff(_group_id, auth.uid()) then
    raise exception 'not_authorized';
  end if;
  update public.group_members set status = 'banned' where group_id = _group_id and user_id = _target_user;
  insert into public.group_messages(group_id, sender_id, system_event)
  values (_group_id, _target_user, 'banned');
end;
$$;
revoke all on function public.ban_group_member(uuid, uuid, text) from public, anon;
grant execute on function public.ban_group_member(uuid, uuid, text) to authenticated;

create or replace function public.unban_group_member(_group_id uuid, _target_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_group_staff(_group_id, auth.uid()) then
    raise exception 'not_authorized';
  end if;
  delete from public.group_members where group_id = _group_id and user_id = _target_user and status = 'banned';
end;
$$;
revoke all on function public.unban_group_member(uuid, uuid) from public, anon;
grant execute on function public.unban_group_member(uuid, uuid) to authenticated;

create or replace function public.remove_group_member(_group_id uuid, _target_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_group_staff(_group_id, auth.uid()) then
    raise exception 'not_authorized';
  end if;
  update public.group_members set status = 'left' where group_id = _group_id and user_id = _target_user;
  insert into public.group_messages(group_id, sender_id, system_event)
  values (_group_id, _target_user, 'removed');
end;
$$;
revoke all on function public.remove_group_member(uuid, uuid) from public, anon;
grant execute on function public.remove_group_member(uuid, uuid) to authenticated;

create or replace function public.set_group_admin(_group_id uuid, _target_user uuid, _make_admin boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_group_owner(_group_id, auth.uid()) then
    raise exception 'not_authorized';
  end if;
  update public.group_members
    set role = case when _make_admin then 'admin'::public.group_role else 'member'::public.group_role end
    where group_id = _group_id and user_id = _target_user and role <> 'owner';
end;
$$;
revoke all on function public.set_group_admin(uuid, uuid, boolean) from public, anon;
grant execute on function public.set_group_admin(uuid, uuid, boolean) to authenticated;

create or replace function public.regenerate_group_invite(_group_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  _new_code text;
begin
  if not public.is_group_staff(_group_id, auth.uid()) then
    raise exception 'not_authorized';
  end if;
  _new_code := substr(md5(random()::text || clock_timestamp()::text), 1, 8);
  update public.groups set invite_code = _new_code, updated_at = now() where id = _group_id;
  return _new_code;
end;
$$;
revoke all on function public.regenerate_group_invite(uuid) from public, anon;
grant execute on function public.regenerate_group_invite(uuid) to authenticated;

-- ===== RLS policies =====

drop policy if exists "groups: members select" on public.groups;
create policy "groups: members select" on public.groups
  for select to authenticated using (public.is_group_member(id, auth.uid()));

drop policy if exists "groups: authenticated create" on public.groups;
create policy "groups: authenticated create" on public.groups
  for insert to authenticated with check (owner_id = auth.uid());

drop policy if exists "groups: owner delete" on public.groups;
create policy "groups: owner delete" on public.groups
  for delete to authenticated using (owner_id = auth.uid());

drop policy if exists "group_members: members select" on public.group_members;
create policy "group_members: members select" on public.group_members
  for select to authenticated using (public.is_group_member(group_id, auth.uid()));

drop policy if exists "group_members: staff manage" on public.group_members;
create policy "group_members: staff manage" on public.group_members
  for all to authenticated
  using (public.is_group_staff(group_id, auth.uid()) or user_id = auth.uid())
  with check (public.is_group_staff(group_id, auth.uid()) or user_id = auth.uid());

drop policy if exists "group_messages: members select" on public.group_messages;
create policy "group_messages: members select" on public.group_messages
  for select to authenticated using (public.is_group_member(group_id, auth.uid()));

drop policy if exists "group_messages: members insert" on public.group_messages;
create policy "group_messages: members insert" on public.group_messages
  for insert to authenticated
  with check (sender_id = auth.uid() and public.can_post_in_group(group_id, auth.uid()));

drop policy if exists "group_reports: reporter insert" on public.group_reports;
create policy "group_reports: reporter insert" on public.group_reports
  for insert to authenticated with check (reporter_id = auth.uid());

drop policy if exists "group_reports: staff select" on public.group_reports;
create policy "group_reports: staff select" on public.group_reports
  for select to authenticated using (public.is_group_staff(group_id, auth.uid()) or reporter_id = auth.uid());
