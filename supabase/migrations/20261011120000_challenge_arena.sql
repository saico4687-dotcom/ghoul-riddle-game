-- التحدي (الحلبة): اسم الحلبة + جدول التحديات + اختيار صديق متاح عشوائي.
-- كل القراءة والكتابة من دالة السيرفر challenge (service_role).

alter table public.profiles
  add column if not exists ring_name text,
  add column if not exists ring_signed_at timestamptz;

create table if not exists public.challenges (
  id uuid primary key default gen_random_uuid(),
  challenger_id uuid not null references auth.users(id) on delete cascade,
  opponent_id uuid not null references auth.users(id) on delete cascade,
  riddle_index integer not null,
  game text not null,
  status text not null default 'open'
    check (status in ('open','playing','finished','declined','expired','cancelled')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '45 seconds'),
  accepted_at timestamptz,
  starts_at timestamptz,
  ends_at timestamptz,
  challenger_option text,
  challenger_at timestamptz,
  challenger_ms integer,
  challenger_done boolean not null default false,
  opponent_option text,
  opponent_at timestamptz,
  opponent_ms integer,
  opponent_done boolean not null default false,
  challenger_entrance smallint,
  opponent_entrance smallint,
  challenger_correct boolean,
  opponent_correct boolean,
  winner text check (winner in ('challenger','opponent','draw')),
  finished_at timestamptz,
  check (challenger_id <> opponent_id)
);

create index if not exists challenges_challenger_idx on public.challenges (challenger_id, created_at desc);
create index if not exists challenges_opponent_idx on public.challenges (opponent_id, status, expires_at);

alter table public.challenges enable row level security;
revoke all on public.challenges from anon, authenticated;
grant all on public.challenges to service_role;

-- صديق متاح عشوائي: متاح + فاتح التطبيق (نبضة < 45 ث) + مش محظور + مش مشغول في تحدي/مساعدة.
create or replace function public.challenge_candidates(p_user uuid, p_limit integer default 1)
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
    and hs.user_id <> p_user
    and exists (
      select 1 from public.friends f
      where (f.user_id = p_user and f.friend_id = hs.user_id)
         or (f.user_id = hs.user_id and f.friend_id = p_user)
    )
    and (p.is_suspended_until is null or p.is_suspended_until < now())
    and not exists (
      select 1 from public.blocked_users b
      where (b.blocker_id = hs.user_id and b.blocked_id = p_user)
         or (b.blocker_id = p_user and b.blocked_id = hs.user_id)
    )
    and not exists (
      select 1 from public.challenges c
      where (c.challenger_id = hs.user_id or c.opponent_id = hs.user_id)
        and ((c.status = 'open' and c.expires_at > now())
          or (c.status = 'playing' and coalesce(c.ends_at, now()) > now() - interval '10 seconds'))
    )
    and not exists (
      select 1 from public.help_requests h
      where h.helper_id = hs.user_id and h.status = 'accepted' and h.expires_at > now()
    )
  order by random()
  limit greatest(p_limit, 0);
$$;

revoke all on function public.challenge_candidates(uuid, integer) from public, anon, authenticated;
grant execute on function public.challenge_candidates(uuid, integer) to service_role;
