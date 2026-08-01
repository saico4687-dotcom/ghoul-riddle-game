-- ============================================================
-- حذف الوسائط المؤقتة: دوال + Cron
-- (مطابقة لما هو منشور بالفعل على مشروع Supabase الإنتاجي)
-- بند 2: حذف تلقائي كل 15 دقيقة لأي وسائط تجاوزت media_expires_at
-- بند 3: حذف فوري عند تأكيد استلام/فتح المستقبل للوسائط
-- ============================================================

-- ---------- دوال القراءة/التأكيد (SECURITY DEFINER، بصلاحية طالبها) ----------

create or replace function public.ack_dm_media_delivered(_message_id uuid)
returns text
language plpgsql
security definer
set search_path to 'public'
as $function$
declare _path text;
begin
  select media_path into _path from public.messages m
  join public.conversations c on c.id = m.conversation_id
  where m.id = _message_id
    and (auth.uid() = c.user_a or auth.uid() = c.user_b)
    and m.media_deleted_at is null and m.media_path is not null;

  return _path; -- NULL لو مفيش صلاحية أو الملف اتمسح خلاص
end;
$function$;

create or replace function public.ack_group_media_delivered(_message_id uuid)
returns text
language plpgsql
security definer
set search_path to 'public'
as $function$
declare _path text;
begin
  select gm2.media_path into _path from public.group_messages gm2
  join public.group_members mem on mem.group_id = gm2.group_id
  where gm2.id = _message_id
    and mem.user_id = auth.uid() and mem.status = 'active'
    and gm2.media_deleted_at is null and gm2.media_path is not null;

  return _path;
end;
$function$;

-- ---------- دوال الحذف الجماعي (service_role فقط) ----------

create or replace function public.list_expired_ephemeral_media()
returns table(path text)
language sql
security definer
set search_path to 'public'
as $function$
  select media_path from public.messages
    where media_path is not null and media_deleted_at is null and media_expires_at < now()
  union all
  select media_path from public.group_messages
    where media_path is not null and media_deleted_at is null and media_expires_at < now();
$function$;

create or replace function public.mark_media_deleted(_paths text[])
returns void
language sql
security definer
set search_path to 'public'
as $function$
  update public.messages set media_deleted_at = now(), media_key = null, media_iv = null
    where media_path = any(_paths) and media_deleted_at is null;
  update public.group_messages set media_deleted_at = now(), media_key = null, media_iv = null
    where media_path = any(_paths) and media_deleted_at is null;
$function$;

-- ---------- الصلاحيات ----------

revoke all on function public.ack_dm_media_delivered(uuid) from public, anon;
grant execute on function public.ack_dm_media_delivered(uuid) to authenticated;

revoke all on function public.ack_group_media_delivered(uuid) from public, anon;
grant execute on function public.ack_group_media_delivered(uuid) to authenticated;

revoke all on function public.list_expired_ephemeral_media() from public, anon, authenticated;
grant execute on function public.list_expired_ephemeral_media() to service_role;

revoke all on function public.mark_media_deleted(text[]) from public, anon, authenticated;
grant execute on function public.mark_media_deleted(text[]) to service_role;

-- ---------- Cron: تشغيل cleanup-expired-media كل 15 دقيقة ----------
-- ملاحظة: يتطلب تفعيل الإضافتين pg_cron و pg_net على المشروع
-- (متاحتين افتراضيًا على Supabase). السر المشترك x-cleanup-secret
-- لازم يتطابق مع القيمة المضبوطة داخل الـ Edge Function نفسها؛
-- يُفضّل نقله لاحقًا إلى Supabase Function Secrets بدل القيمة الثابتة.

create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'cleanup-expired-ephemeral-media',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := 'https://znyeowpftkhyfcopiebs.supabase.co/functions/v1/cleanup-expired-media',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cleanup-secret', 'e9de4eba042dbd5a5f13537f118f9639774cd203e5ece6ecc4d1d3cc31c99c2'
    ),
    body := '{}'::jsonb
  );
  $$
) where not exists (select 1 from cron.job where jobname = 'cleanup-expired-ephemeral-media');
