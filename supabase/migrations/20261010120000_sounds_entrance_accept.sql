-- نظام الأصوات (المحادثة 2):
--  1) دخلة مصارع لكل مستخدم (1..10) بيختارها السيرفر بالترتيب.
--  2) إشعار "اتقبل طلب صداقتك" للي بعت الطلب (عشان تشتغل دخلة المصارع عنده).
-- شغّله مرة واحدة في Supabase SQL Editor (آمن لو اتشغّل أكتر من مرة).

create sequence if not exists public.entrance_seq start 0 minvalue 0;

alter table public.profiles
  add column if not exists entrance_no smallint;

-- المستخدمين الحاليين: توزيع بالترتيب 1..10 ثم من الأول.
with ranked as (
  select user_id, ((row_number() over (order by user_id) - 1) % 10) + 1 as n
  from public.profiles
  where entrance_no is null
)
update public.profiles p
set entrance_no = r.n
from ranked r
where p.user_id = r.user_id;

-- نكمّل العدّاد من بعد آخر واحد اتوزع.
select setval('public.entrance_seq', coalesce((select count(*) from public.profiles), 0));

-- أي مستخدم جديد ياخد الدخلة اللي بعدها بالترتيب.
alter table public.profiles
  alter column entrance_no set default ((nextval('public.entrance_seq') % 10) + 1);

alter table public.friend_requests
  add column if not exists accept_notified boolean not null default false;

-- القديم اللي اتقبل قبل كده: ما نبعتش له إشعارات متأخرة.
update public.friend_requests set accept_notified = true where status = 'accepted' and accept_notified = false;

create index if not exists friend_requests_accept_idx
  on public.friend_requests (from_user)
  where status = 'accepted' and accept_notified = false;

-- للتأكد بعد التشغيل (لازم يرجّع صفين):
-- select table_name, column_name from information_schema.columns
-- where table_schema = 'public'
--   and ((table_name = 'profiles' and column_name = 'entrance_no')
--     or (table_name = 'friend_requests' and column_name = 'accept_notified'));
