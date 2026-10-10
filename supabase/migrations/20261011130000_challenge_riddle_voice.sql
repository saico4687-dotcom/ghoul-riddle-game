-- التحدي من صفحة اللغز: تحدي بصوت (5 يوميًا) أو بدون صوت.
alter table public.challenges
  add column if not exists voice boolean not null default false,
  add column if not exists session_key text not null
    default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  add column if not exists from_riddle boolean not null default false;
