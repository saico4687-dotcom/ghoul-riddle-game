-- استعن بصديق (النسخة 2):
--  1) حفظ اختيار اللاعب (عشان نقدر نعلّم ❌ على اختيار المساعد الغلط).
--  2) نوع الطلب: صوت (voice) أو تلميح بدون صوت (hint).
--  3) وقت بداية الصوت (بعد ما الطرفين يتوصلوا).
--  4) المساعد اللي جاوب غلط يقدر يساعد في طلبات الصوت.
-- شغّله مرة واحدة في Supabase SQL Editor (آمن لو اتشغّل أكتر من مرة).

alter table public.riddle_starts
  add column if not exists selected_option text;

alter table public.help_requests
  add column if not exists kind text not null default 'voice',
  add column if not exists voice_started_at timestamptz,
  add column if not exists asker_voice_ready boolean not null default false,
  add column if not exists helper_voice_ready boolean not null default false,
  add column if not exists helper_was_wrong boolean not null default false,
  add column if not exists helper_wrong_option text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'help_requests_kind_check'
  ) then
    alter table public.help_requests
      add constraint help_requests_kind_check check (kind in ('voice', 'hint'));
  end if;
end $$;

create index if not exists help_requests_asker_kind_idx
  on public.help_requests (asker_id, kind, created_at desc);

-- اختيار المساعدين: p_kind = 'voice' => أي حد جاوب اللغز (صح أو غلط)،
--                    p_kind = 'hint'  => اللي جاوبه صح بس.
drop function if exists public.help_eligible_helpers(uuid, integer, integer, text);

create or replace function public.help_eligible_helpers(
  p_asker uuid,
  p_riddle integer,
  p_limit integer,
  p_mode text default 'all',
  p_kind text default 'hint'
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
      case when p_kind = 'voice' then
        -- جاوب اللغز (صح أو غلط)
        exists (
          select 1 from public.answer_times a
          where a.user_id = hs.user_id
            and a.riddle_index = p_riddle + 1
        )
        or exists (
          select 1 from public.riddle_starts r
          where r.user_id = hs.user_id
            and r.riddle_index = p_riddle
            and r.answered_at is not null
        )
      else
        -- جاوبه صح
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
      end
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

revoke all on function public.help_eligible_helpers(uuid, integer, integer, text, text) from public, anon, authenticated;
grant execute on function public.help_eligible_helpers(uuid, integer, integer, text, text) to service_role;

-- للتأكد بعد التشغيل (لازم يرجّع 6 صفوف أعمدة جديدة + 1 للـ riddle_starts):
-- select table_name, column_name from information_schema.columns
-- where table_schema = 'public'
--   and ((table_name = 'help_requests' and column_name in
--         ('kind','voice_started_at','asker_voice_ready','helper_voice_ready','helper_was_wrong','helper_wrong_option'))
--     or (table_name = 'riddle_starts' and column_name = 'selected_option'));
