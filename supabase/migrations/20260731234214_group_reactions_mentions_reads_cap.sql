-- ===== تفاعلات إيموجي على رسائل الجروب =====
create table if not exists public.group_message_reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.group_messages(id) on delete cascade,
  user_id uuid not null,
  emoji text not null,
  created_at timestamptz not null default now(),
  unique (message_id, user_id, emoji)
);

alter table public.group_message_reactions enable row level security;

create policy "group_message_reactions: members can view"
  on public.group_message_reactions for select
  using (exists (
    select 1 from public.group_messages gm
    where gm.id = group_message_reactions.message_id
      and is_group_member(gm.group_id, auth.uid())
  ));

create policy "group_message_reactions: members can react"
  on public.group_message_reactions for insert
  with check (
    user_id = auth.uid() and exists (
      select 1 from public.group_messages gm
      where gm.id = group_message_reactions.message_id
        and is_group_member(gm.group_id, auth.uid())
    )
  );

create policy "group_message_reactions: unreact own"
  on public.group_message_reactions for delete
  using (user_id = auth.uid());

-- ===== منشن @username (فردي وجروب) =====
create table if not exists public.message_mentions (
  id uuid primary key default gen_random_uuid(),
  group_message_id uuid references public.group_messages(id) on delete cascade,
  message_id uuid references public.messages(id) on delete cascade,
  mentioned_user_id uuid not null,
  created_at timestamptz not null default now(),
  check (
    (group_message_id is not null and message_id is null) or
    (group_message_id is null and message_id is not null)
  )
);

alter table public.message_mentions enable row level security;

create policy "message_mentions: mentioned user can view"
  on public.message_mentions for select
  using (
    mentioned_user_id = auth.uid()
    or exists (
      select 1 from public.group_messages gm
      where gm.id = message_mentions.group_message_id
        and is_group_member(gm.group_id, auth.uid())
    )
    or exists (
      select 1 from public.messages m
      join public.conversations c on c.id = m.conversation_id
      where m.id = message_mentions.message_id
        and (auth.uid() = c.user_a or auth.uid() = c.user_b)
    )
  );

create policy "message_mentions: sender can insert"
  on public.message_mentions for insert
  with check (
    exists (
      select 1 from public.group_messages gm
      where gm.id = message_mentions.group_message_id
        and gm.sender_id = auth.uid()
    )
    or exists (
      select 1 from public.messages m
      where m.id = message_mentions.message_id
        and m.sender_id = auth.uid()
    )
  );

create index if not exists idx_message_mentions_user on public.message_mentions(mentioned_user_id);

-- ===== إيصالات قراءة دقيقة لكل عضو في الجروب =====
create table if not exists public.group_message_reads (
  message_id uuid not null references public.group_messages(id) on delete cascade,
  user_id uuid not null,
  read_at timestamptz not null default now(),
  primary key (message_id, user_id)
);

alter table public.group_message_reads enable row level security;

create policy "group_message_reads: members can view"
  on public.group_message_reads for select
  using (exists (
    select 1 from public.group_messages gm
    where gm.id = group_message_reads.message_id
      and is_group_member(gm.group_id, auth.uid())
  ));

create policy "group_message_reads: mark own read"
  on public.group_message_reads for insert
  with check (
    user_id = auth.uid() and exists (
      select 1 from public.group_messages gm
      where gm.id = group_message_reads.message_id
        and is_group_member(gm.group_id, auth.uid())
    )
  );

create index if not exists idx_group_message_reads_msg on public.group_message_reads(message_id);

-- ===== حد أقصى لأعضاء الجروب (1024 زي واتساب) =====
create or replace function public.enforce_group_member_cap()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  current_count integer;
begin
  if new.status = 'active' then
    select count(*) into current_count
    from public.group_members
    where group_id = new.group_id and status = 'active';
    if current_count >= 1024 then
      raise exception 'group_member_limit_reached';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_group_member_cap on public.group_members;
create trigger trg_enforce_group_member_cap
  before insert on public.group_members
  for each row execute function public.enforce_group_member_cap();
