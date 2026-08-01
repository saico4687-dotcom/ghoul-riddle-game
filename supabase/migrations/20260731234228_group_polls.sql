-- ===== استطلاعات رأي (Polls) داخل الجروب =====
create table if not exists public.group_polls (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  message_id uuid references public.group_messages(id) on delete cascade,
  creator_id uuid not null,
  question text not null,
  allow_multiple boolean not null default false,
  closed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.group_poll_options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.group_polls(id) on delete cascade,
  option_text text not null,
  position integer not null default 0
);

create table if not exists public.group_poll_votes (
  poll_id uuid not null references public.group_polls(id) on delete cascade,
  option_id uuid not null references public.group_poll_options(id) on delete cascade,
  user_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (poll_id, option_id, user_id)
);

alter table public.group_polls enable row level security;
alter table public.group_poll_options enable row level security;
alter table public.group_poll_votes enable row level security;

create policy "group_polls: members can view"
  on public.group_polls for select
  using (is_group_member(group_id, auth.uid()));

create policy "group_polls: eligible members can create"
  on public.group_polls for insert
  with check (creator_id = auth.uid() and can_post_in_group(group_id, auth.uid()));

create policy "group_polls: creator or staff can close"
  on public.group_polls for update
  using (creator_id = auth.uid() or is_group_staff(group_id, auth.uid()))
  with check (creator_id = auth.uid() or is_group_staff(group_id, auth.uid()));

create policy "group_poll_options: members can view"
  on public.group_poll_options for select
  using (exists (
    select 1 from public.group_polls p
    where p.id = group_poll_options.poll_id and is_group_member(p.group_id, auth.uid())
  ));

create policy "group_poll_options: poll creator can add"
  on public.group_poll_options for insert
  with check (exists (
    select 1 from public.group_polls p
    where p.id = group_poll_options.poll_id and p.creator_id = auth.uid()
  ));

create policy "group_poll_votes: members can view"
  on public.group_poll_votes for select
  using (exists (
    select 1 from public.group_polls p
    where p.id = group_poll_votes.poll_id and is_group_member(p.group_id, auth.uid())
  ));

create policy "group_poll_votes: members can vote"
  on public.group_poll_votes for insert
  with check (
    user_id = auth.uid() and exists (
      select 1 from public.group_polls p
      where p.id = group_poll_votes.poll_id
        and is_group_member(p.group_id, auth.uid())
        and (p.closed_at is null or p.closed_at > now())
    )
  );

create policy "group_poll_votes: unvote own"
  on public.group_poll_votes for delete
  using (user_id = auth.uid());
