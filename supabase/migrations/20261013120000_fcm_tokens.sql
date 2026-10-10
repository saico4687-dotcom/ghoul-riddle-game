-- توكنات إشعارات الموبايل الحقيقية (Firebase Cloud Messaging) — منفصلة عن device_tokens بتاعة الويب.
create table if not exists public.fcm_tokens (
  token text primary key,
  user_id uuid not null,
  platform text not null default 'android',
  updated_at timestamptz not null default now()
);
create index if not exists fcm_tokens_user_idx on public.fcm_tokens (user_id);
alter table public.fcm_tokens enable row level security;
drop policy if exists "fcm_tokens: owner" on public.fcm_tokens;
create policy "fcm_tokens: owner" on public.fcm_tokens for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- المتاح للتحدي = "أنا متاح" شغّال + (فاتح التطبيق الآن أو عنده إشعارات مسجّلة آخر 14 يوم).
create or replace function public.challenge_candidates(p_user uuid, p_limit integer default 1)
returns table (user_id uuid)
language sql stable security definer set search_path to 'public'
as $$
  select hs.user_id
  from public.helper_settings hs
  join public.profiles p on p.user_id = hs.user_id
  where hs.available
    and (
      hs.last_ping > now() - interval '45 seconds'
      or exists (select 1 from public.fcm_tokens t where t.user_id = hs.user_id and t.updated_at > now() - interval '14 days')
    )
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
