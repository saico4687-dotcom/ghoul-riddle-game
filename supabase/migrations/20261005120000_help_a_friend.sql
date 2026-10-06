-- ميزة "استعين بصديق"
-- كل الكتابة والقراءة بتتم من دالة السيرفر help-request (service_role) —
-- التطبيق نفسه مبيلمسش الجداول دي مباشرة.

-- 1) أعمدة إضافية على riddle_starts
alter table public.riddle_starts
  add column if not exists assisted boolean not null default false,
  add column if not exists assisted_by uuid,
  add column if not exists unranked boolean not null default false,
  add column if not exists pending_restart boolean not null default false;

-- باقة "خط النجدة" (مدة الصوت 60 أو 120 ثانية، سنة من تاريخ الشراء)
alter table public.profiles
  add column if not exists help_pass_tier smallint not null default 0,
  add column if not exists help_pass_until timestamptz;

-- السماح بمنتجات باقة "خط النجدة" في سجل المشتريات
alter table public.purchases drop constraint if exists purchases_product_check;
alter table public.purchases add constraint purchases_product_check
  check (product in ('reward_unlock', 'no_ads', 'no_interstitial', 'answers_100', 'answers_200', 'help_voice_1', 'help_voice_2'));

-- 2) إعدادات "أنا متاح للمساعدة"
create table if not exists public.helper_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  available boolean not null default false,
  last_ping timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.helper_settings enable row level security;
revoke all on public.helper_settings from anon, authenticated;
grant all on public.helper_settings to service_role;

-- 3) طلبات المساعدة
create table if not exists public.help_requests (
  id uuid primary key default gen_random_uuid(),
  asker_id uuid not null references auth.users(id) on delete cascade,
  riddle_index integer not null,
  status text not null default 'open'
    check (status in ('open', 'accepted', 'answered', 'expired', 'cancelled')),
  notified_ids uuid[] not null default '{}',
  helper_id uuid references auth.users(id) on delete set null,
  session_key text not null
    default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '60 seconds'),
  accepted_at timestamptz,
  answered_at timestamptz,
  hint_text text,
  helper_correct boolean,
  helper_points integer not null default 0,
  retry_used boolean not null default false,
  talk_seconds integer not null default 60,
  talk_extended boolean not null default false
);

alter table public.help_requests
  add column if not exists talk_seconds integer not null default 60,
  add column if not exists talk_extended boolean not null default false;

create index if not exists help_requests_asker_idx on public.help_requests (asker_id, created_at desc);
create index if not exists help_requests_helper_idx on public.help_requests (helper_id, answered_at);
create index if not exists help_requests_status_idx on public.help_requests (status, expires_at);

alter table public.help_requests enable row level security;
revoke all on public.help_requests from anon, authenticated;
grant all on public.help_requests to service_role;

-- 4) المساعدين المؤهلين: متاح + فاتح التطبيق دلوقتي + حلّ اللغز ده صح
--    + مش محظور + مخلّصش الحد اليومي (10) + مساعدش نفس اللاعب النهارده + مش مشغول.
-- جداول الحظر والأصدقاء (لو مش موجودة عندك تتعمل فاضية، ولو موجودة ما يحصلش أي تغيير)
do $$
begin
  if to_regclass('public.blocked_users') is null then
    create table public.blocked_users (
      blocker_id uuid not null references auth.users(id) on delete cascade,
      blocked_id uuid not null references auth.users(id) on delete cascade,
      created_at timestamptz not null default now(),
      primary key (blocker_id, blocked_id),
      check (blocker_id <> blocked_id)
    );
    alter table public.blocked_users enable row level security;
    revoke all on public.blocked_users from anon, authenticated;
    grant all on public.blocked_users to service_role;
  end if;
  if to_regclass('public.friends') is null then
    create table public.friends (
      user_id uuid not null references auth.users(id) on delete cascade,
      friend_id uuid not null references auth.users(id) on delete cascade,
      created_at timestamptz not null default now(),
      primary key (user_id, friend_id),
      check (user_id <> friend_id)
    );
    alter table public.friends enable row level security;
    revoke all on public.friends from anon, authenticated;
    grant all on public.friends to service_role;
  end if;
  if to_regclass('public.friend_requests') is null then
    create table public.friend_requests (
      id uuid primary key default gen_random_uuid(),
      from_user uuid not null references auth.users(id) on delete cascade,
      to_user uuid not null references auth.users(id) on delete cascade,
      status text not null default 'pending' check (status in ('pending','accepted','rejected','cancelled')),
      created_at timestamptz not null default now(),
      responded_at timestamptz,
      unique (from_user, to_user),
      check (from_user <> to_user)
    );
    alter table public.friend_requests enable row level security;
    revoke all on public.friend_requests from anon, authenticated;
    grant all on public.friend_requests to service_role;
  end if;
end
$$;

-- p_mode: all = الكل، friends = الأصدقاء بس، others = غير الأصدقاء بس
drop function if exists public.help_eligible_helpers(uuid, integer, integer);
create or replace function public.help_eligible_helpers(
  p_asker uuid,
  p_riddle integer,
  p_limit integer,
  p_mode text default 'all'
)
returns table (user_id uuid)
language sql
stable
security definer
set search_path to 'public'
as $$
  select hs.user_id
  from public.helper_settings hs
  join public.profiles p on p.user_id = hs.user_id
  where hs.available
    and hs.last_ping > now() - interval '45 seconds'
    and hs.user_id <> p_asker
    and (
      p_mode = 'all'
      or (p_mode = 'friends') = exists (
        select 1 from public.friends f
        where (f.user_id = p_asker and f.friend_id = hs.user_id)
           or (f.user_id = hs.user_id and f.friend_id = p_asker)
      )
    )
    and (p.is_suspended_until is null or p.is_suspended_until < now())
    and not exists (
      select 1 from public.blocked_users b
      where (b.blocker_id = hs.user_id and b.blocked_id = p_asker)
         or (b.blocker_id = p_asker and b.blocked_id = hs.user_id)
    )
    and (
      exists (
        select 1 from public.answer_times a
        where a.user_id = hs.user_id
          and a.riddle_index = p_riddle + 1
          and a.is_correct
      )
      or exists (
        select 1 from public.riddle_starts r
        where r.user_id = hs.user_id
          and r.riddle_index = p_riddle
          and (r.result ->> 'isCorrect') = 'true'
      )
    )
    and (
      select count(*) from public.help_requests h
      where h.helper_id = hs.user_id
        and h.status = 'answered'
        and h.helper_points > 0
        and (h.answered_at at time zone 'Africa/Cairo')::date = (now() at time zone 'Africa/Cairo')::date
    ) < 10
    and not exists (
      select 1 from public.help_requests h
      where h.helper_id = hs.user_id
        and h.asker_id = p_asker
        and h.status = 'answered'
        and h.helper_points > 0
        and (h.answered_at at time zone 'Africa/Cairo')::date = (now() at time zone 'Africa/Cairo')::date
    )
    and not exists (
      select 1 from public.help_requests h
      where h.helper_id = hs.user_id
        and h.status = 'accepted'
        and h.expires_at > now()
    )
  order by random()
  limit greatest(p_limit, 0);
$$;

revoke all on function public.help_eligible_helpers(uuid, integer, integer, text) from public, anon, authenticated;
grant execute on function public.help_eligible_helpers(uuid, integer, integer, text) to service_role;

-- 5) إضافة نقاط المساعد بشكل ذرّي (من غير قراءة ثم كتابة)
create or replace function public.help_add_points(p_user uuid, p_points integer)
returns void
language sql
security definer
set search_path to 'public'
as $$
  update public.profiles
  set saved_total_points = coalesce(saved_total_points, 0) + greatest(p_points, 0),
      updated_at = now()
  where user_id = p_user;
$$;

revoke all on function public.help_add_points(uuid, integer) from public, anon, authenticated;
grant execute on function public.help_add_points(uuid, integer) to service_role;

-- 6) للمالك: أفضل المساعدين في الأسبوع
create or replace function public.get_weekly_top_helpers(target_week_start timestamptz)
returns table (user_id uuid, helps bigint, points bigint)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'Only admins may call get_weekly_top_helpers';
  end if;

  return query
  select h.helper_id, count(*)::bigint, coalesce(sum(h.helper_points), 0)::bigint
  from public.help_requests h
  where h.status = 'answered'
    and h.helper_points > 0
    and h.helper_id is not null
    and h.answered_at >= date_trunc('week', target_week_start)
    and h.answered_at < date_trunc('week', target_week_start) + interval '7 days'
  group by h.helper_id
  order by 3 desc, 2 desc
  limit 5;
end;
$$;

revoke all on function public.get_weekly_top_helpers(timestamptz) from public, anon;
grant execute on function public.get_weekly_top_helpers(timestamptz) to authenticated;

-- 7) للمالك: مين استخدم الاستعانة بصديق في إجابات صحيحة الأسبوع ده
create or replace function public.get_weekly_assisted_count(target_week_start timestamptz)
returns table (user_id uuid, assisted_correct bigint)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'Only admins may call get_weekly_assisted_count';
  end if;

  return query
  select r.user_id, count(*)::bigint
  from public.riddle_starts r
  where r.assisted
    and r.answered_at >= date_trunc('week', target_week_start)
    and r.answered_at < date_trunc('week', target_week_start) + interval '7 days'
    and (r.result ->> 'isCorrect') = 'true'
  group by r.user_id;
end;
$$;

revoke all on function public.get_weekly_assisted_count(timestamptz) from public, anon;
grant execute on function public.get_weekly_assisted_count(timestamptz) to authenticated;
