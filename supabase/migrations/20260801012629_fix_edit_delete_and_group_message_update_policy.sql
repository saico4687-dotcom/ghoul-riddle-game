-- ============================================================
-- إصلاح: التريجر enforce_message_edit_delete_window (من ملف
-- 20260731234247) كان بيرجع لعمودين مش موجودين أصلاً في الجدول:
-- edited_at و is_deleted_for_everyone. النتيجة: أي محاولة تعديل
-- أو حذف لرسالة فردية كانت بتفشل فورًا بخطأ Postgres
-- "column does not exist" — يعني ميزة التعديل والحذف معطّلة
-- بالكامل حاليًا. نفس المشكلة لعمود edited_at في group_messages.
-- ============================================================

-- الأعمدة الناقصة
alter table public.messages add column if not exists edited_at timestamptz;
alter table public.messages add column if not exists deleted_for uuid[] not null default '{}'::uuid[];

alter table public.group_messages add column if not exists edited_at timestamptz;
alter table public.group_messages add column if not exists deleted_for uuid[] not null default '{}'::uuid[];

-- إعادة كتابة التريجر الخاص بالرسائل الفردية: نستخدم العمود
-- الموجود فعلاً (deleted_at) بدل is_deleted_for_everyone، ونضيف
-- تحقق إن التعديل/الحذف-للكل يقدر يعمله صاحب الرسالة بس، وإن
-- deleted_for (حذف من عندي) يقدر يضيف لنفسه بس من غير ما يلمس
-- بيانات حد تاني.
create or replace function public.enforce_message_edit_delete_window()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.body is distinct from old.body then
    if auth.uid() is distinct from old.sender_id then
      raise exception 'unauthorized_edit';
    end if;
    if now() - old.created_at > interval '15 minutes' then
      raise exception 'edit_window_expired';
    end if;
    new.edited_at := now();
  end if;

  if new.deleted_at is not null and old.deleted_at is null then
    if auth.uid() is distinct from old.sender_id then
      raise exception 'unauthorized_delete';
    end if;
    if now() - old.created_at > interval '60 hours' then
      raise exception 'delete_for_everyone_window_expired';
    end if;
    new.body := 'تم حذف هذه الرسالة';
  end if;

  if new.deleted_for is distinct from old.deleted_for then
    if new.deleted_for is distinct from (old.deleted_for || array[auth.uid()]) then
      raise exception 'invalid_deleted_for_update';
    end if;
  end if;

  return new;
end;
$$;

-- نفس المنطق لرسائل الجروب (زيادة تحقق صاحب الرسالة + deleted_for)
create or replace function public.enforce_group_message_edit_delete_window()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.body is distinct from old.body then
    if auth.uid() is distinct from old.sender_id then
      raise exception 'unauthorized_edit';
    end if;
    if now() - old.created_at > interval '15 minutes' then
      raise exception 'edit_window_expired';
    end if;
    new.edited_at := now();
  end if;

  if new.deleted_at is not null and old.deleted_at is null and new.system_event is null then
    if auth.uid() is distinct from old.sender_id then
      raise exception 'unauthorized_delete';
    end if;
    if now() - old.created_at > interval '60 hours' then
      raise exception 'delete_for_everyone_window_expired';
    end if;
  end if;

  if new.deleted_for is distinct from old.deleted_for then
    if new.deleted_for is distinct from (old.deleted_for || array[auth.uid()]) then
      raise exception 'invalid_deleted_for_update';
    end if;
  end if;

  return new;
end;
$$;

-- ============================================================
-- ثغرة تانية منفصلة: مفيش أي UPDATE policy على group_messages
-- من الأساس في كل ملفات الـ migrations. يعني أي محاولة تعديل
-- أو حذف رسالة جروب (deleteGroupMessage في groupQueries.ts) كانت
-- بترجع 0 صفوف متأثرة بصمت بسبب RLS، من غير أي خطأ ظاهر للمستخدم.
-- ============================================================
drop policy if exists "group members update messages" on public.group_messages;
create policy "group members update messages" on public.group_messages
  for update to authenticated
  using (is_group_member(group_id, auth.uid()))
  with check (is_group_member(group_id, auth.uid()));
