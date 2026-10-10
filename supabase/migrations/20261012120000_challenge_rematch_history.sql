-- التحدي: سلسلة جولات (نتيجة 1:0) + إعادة اللعب + سجل "تحدياتك".
alter table public.challenges
  add column if not exists rematch_challenger boolean,
  add column if not exists rematch_opponent boolean,
  add column if not exists rematch_id uuid,
  add column if not exists prev_id uuid;

create index if not exists challenges_finished_idx on public.challenges (challenger_id, status, finished_at desc);
create index if not exists challenges_finished_opp_idx on public.challenges (opponent_id, status, finished_at desc);
