-- ===== إعداد الرسائل المؤقتة (Disappearing Messages) على مستوى المحادثة/الجروب =====
alter table public.conversations add column if not exists disappearing_seconds integer;
alter table public.groups add column if not exists disappearing_seconds integer;

-- ===== أعمدة على الرسائل: انتهاء تلقائي، شوهدت مرة واحدة، موقع =====
alter table public.messages add column if not exists expires_at timestamptz;
alter table public.messages add column if not exists view_once boolean not null default false;
alter table public.messages add column if not exists viewed_at timestamptz;
alter table public.messages add column if not exists location_lat double precision;
alter table public.messages add column if not exists location_lng double precision;
alter table public.messages add column if not exists location_label text;
alter table public.messages add column if not exists live_location_until timestamptz;

alter table public.group_messages add column if not exists expires_at timestamptz;
alter table public.group_messages add column if not exists view_once boolean not null default false;
alter table public.group_messages add column if not exists viewed_at timestamptz;
alter table public.group_messages add column if not exists location_lat double precision;
alter table public.group_messages add column if not exists location_lng double precision;
alter table public.group_messages add column if not exists location_label text;
alter table public.group_messages add column if not exists live_location_until timestamptz;

-- ===== تريجر: يحسب expires_at تلقائي وقت الإرسال حسب إعداد المحادثة =====
create or replace function public.set_message_expiry()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  secs integer;
begin
  select disappearing_seconds into secs from public.conversations where id = new.conversation_id;
  if secs is not null then
    new.expires_at := now() + make_interval(secs => secs);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_set_message_expiry on public.messages;
create trigger trg_set_message_expiry
  before insert on public.messages
  for each row execute function public.set_message_expiry();

create or replace function public.set_group_message_expiry()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  secs integer;
begin
  select disappearing_seconds into secs from public.groups where id = new.group_id;
  if secs is not null then
    new.expires_at := now() + make_interval(secs => secs);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_set_group_message_expiry on public.group_messages;
create trigger trg_set_group_message_expiry
  before insert on public.group_messages
  for each row execute function public.set_group_message_expiry();

-- ===== إنفاذ نافذة التعديل (15 دقيقة) والحذف للكل (60 ساعة) - فردي =====
create or replace function public.enforce_message_edit_delete_window()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- تعديل نص الرسالة: خلال 15 دقيقة فقط من الإرسال
  if new.body is distinct from old.body then
    if now() - old.created_at > interval '15 minutes' then
      raise exception 'edit_window_expired';
    end if;
    new.edited_at := now();
  end if;

  -- حذف للكل: خلال 60 ساعة فقط من الإرسال
  if new.is_deleted_for_everyone = true and old.is_deleted_for_everyone = false then
    if now() - old.created_at > interval '60 hours' then
      raise exception 'delete_for_everyone_window_expired';
    end if;
    new.body := 'تم حذف هذه الرسالة';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_message_edit_delete_window on public.messages;
create trigger trg_enforce_message_edit_delete_window
  before update on public.messages
  for each row execute function public.enforce_message_edit_delete_window();

-- ===== نفس المنطق لرسائل الجروب =====
create or replace function public.enforce_group_message_edit_delete_window()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.body is distinct from old.body then
    if now() - old.created_at > interval '15 minutes' then
      raise exception 'edit_window_expired';
    end if;
    new.edited_at := now();
  end if;

  if new.deleted_at is not null and old.deleted_at is null and new.system_event is null then
    if now() - old.created_at > interval '60 hours' then
      raise exception 'delete_for_everyone_window_expired';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_group_message_edit_delete_window on public.group_messages;
create trigger trg_enforce_group_message_edit_delete_window
  before update on public.group_messages
  for each row execute function public.enforce_group_message_edit_delete_window();
