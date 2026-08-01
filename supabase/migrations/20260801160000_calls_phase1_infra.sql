-- ===== المرحلة 1: بنية المكالمات الصوتية/الفيديو (WebRTC Signaling) =====

-- ربط المكالمات بجدول profiles (سلامة بيانات) + فهارس أداء
alter table public.calls
  add constraint calls_caller_id_fkey foreign key (caller_id) references public.profiles(id) on delete cascade,
  add constraint calls_callee_id_fkey foreign key (callee_id) references public.profiles(id) on delete cascade;

create index if not exists idx_calls_caller on public.calls(caller_id, created_at desc);
create index if not exists idx_calls_callee on public.calls(callee_id, created_at desc);
create index if not exists idx_calls_status on public.calls(status);
create index if not exists idx_call_signals_call_id on public.call_signals(call_id, created_at);

-- REPLICA IDENTITY FULL عشان الـ Realtime يبعت الصف كامل عند أي UPDATE (status ringing->accepted->ended)
alter table public.calls replica identity full;
alter table public.call_signals replica identity full;

-- تفعيل Realtime على الجدولين
do $$
begin
  if not exists (
    select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'calls'
  ) then
    alter publication supabase_realtime add table public.calls;
  end if;
  if not exists (
    select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'call_signals'
  ) then
    alter publication supabase_realtime add table public.call_signals;
  end if;
end $$;

-- منع بدء مكالمة جديدة لو فيه مكالمة "ringing" أو "accepted" شغالة بالفعل بين نفس الطرفين
create or replace function public.has_active_call(_a uuid, _b uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from public.calls
    where status in ('ringing','accepted')
      and ((caller_id = _a and callee_id = _b) or (caller_id = _b and callee_id = _a))
  );
$$;

-- بدء مكالمة: يتحقق من الصداقة، الحظر، عدم وجود مكالمة شغالة بالفعل
create or replace function public.start_call(_callee_id uuid, _kind text)
returns public.calls
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  _me uuid := auth.uid();
  _row public.calls;
begin
  if _me is null then
    raise exception 'not authenticated';
  end if;
  if _me = _callee_id then
    raise exception 'cannot call yourself';
  end if;
  if _kind not in ('audio','video') then
    raise exception 'invalid call kind';
  end if;
  if public.is_blocked(_me, _callee_id) then
    raise exception 'blocked';
  end if;
  if not public.are_friends(_me, _callee_id) then
    raise exception 'not friends';
  end if;
  if public.has_active_call(_me, _callee_id) then
    raise exception 'call already in progress';
  end if;

  insert into public.calls(caller_id, callee_id, kind, status)
  values (_me, _callee_id, _kind, 'ringing')
  returning * into _row;

  return _row;
end;
$$;

-- الرد على مكالمة: قبول/رفض — فقط المُستقبِل (callee) يقدر يرد
create or replace function public.respond_to_call(_call_id uuid, _new_status text)
returns public.calls
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  _me uuid := auth.uid();
  _row public.calls;
begin
  if _me is null then
    raise exception 'not authenticated';
  end if;
  if _new_status not in ('accepted','declined') then
    raise exception 'invalid status';
  end if;

  select * into _row from public.calls where id = _call_id for update;
  if _row is null then
    raise exception 'call not found';
  end if;
  if _row.callee_id <> _me then
    raise exception 'only the callee can respond';
  end if;
  if _row.status <> 'ringing' then
    raise exception 'call is not ringing';
  end if;

  update public.calls
    set status = _new_status,
        ended_at = case when _new_status = 'declined' then now() else ended_at end
    where id = _call_id
    returning * into _row;

  return _row;
end;
$$;

-- إنهاء مكالمة: أي طرف من الطرفين، في أي وقت (بما فيه انتهاء الرنين بدون رد -> missed)
create or replace function public.end_call(_call_id uuid, _final_status text default 'ended')
returns public.calls
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  _me uuid := auth.uid();
  _row public.calls;
begin
  if _me is null then
    raise exception 'not authenticated';
  end if;
  if _final_status not in ('ended','missed') then
    raise exception 'invalid final status';
  end if;

  select * into _row from public.calls where id = _call_id for update;
  if _row is null then
    raise exception 'call not found';
  end if;
  if _row.caller_id <> _me and _row.callee_id <> _me then
    raise exception 'not a participant';
  end if;
  if _row.status in ('ended','declined','missed') then
    return _row; -- idempotent
  end if;

  update public.calls
    set status = case when _row.status = 'ringing' and _final_status = 'ended' then 'missed' else _final_status end,
        ended_at = now()
    where id = _call_id
    returning * into _row;

  return _row;
end;
$$;

grant execute on function public.start_call(uuid, text) to authenticated;
grant execute on function public.respond_to_call(uuid, text) to authenticated;
grant execute on function public.end_call(uuid, text) to authenticated;
grant execute on function public.has_active_call(uuid, uuid) to authenticated;
