-- قفل الدردشة برمز PIN (4-6 أرقام) — العمودين app_lock_hash و
-- app_lock_enabled كانوا اتضافوا فعلاً في profiles في migration سابقة
-- (20260731234355_webrtc_signaling_push_tokens_applock_e2e_search.sql).
-- الملف ده بيضيف الدوال اللي بتشتغل عليهم فقط، من غير ما الـ hash
-- يوصل للعميل نهائيًا في أي وقت (كل المقارنة بتحصل جوه الداتابيز).

create extension if not exists pgcrypto;

-- تفعيل القفل أو تغيير الرمز الحالي. لازم يكون المستخدم مسجل دخول
-- (auth.uid())، ولا يقدر يغيّر رمز حد تاني.
create or replace function public.set_app_lock_pin(p_pin text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_pin is null or p_pin !~ '^[0-9]{4,6}$' then
    raise exception 'الرمز لازم يكون من 4 إلى 6 أرقام';
  end if;

  update public.profiles
  set app_lock_hash = crypt(p_pin, gen_salt('bf')),
      app_lock_enabled = true
  where user_id = auth.uid();
end;
$$;

-- تعطيل القفل بالكامل ومسح الـ hash المخزَّن.
create or replace function public.disable_app_lock()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set app_lock_enabled = false,
      app_lock_hash = null
  where user_id = auth.uid();
end;
$$;

-- التحقق من الرمز المُدخَل. بيرجع true/false بس، من غير ما يسرّب
-- أي معلومة عن الـ hash نفسه.
create or replace function public.verify_app_lock_pin(p_pin text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  stored_hash text;
begin
  select app_lock_hash into stored_hash
  from public.profiles
  where user_id = auth.uid();

  if stored_hash is null then
    return false;
  end if;

  return stored_hash = crypt(p_pin, stored_hash);
end;
$$;

grant execute on function public.set_app_lock_pin(text) to authenticated;
grant execute on function public.disable_app_lock() to authenticated;
grant execute on function public.verify_app_lock_pin(text) to authenticated;
