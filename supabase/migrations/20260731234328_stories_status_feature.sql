-- ===== الحالة / الستوري (Status) — مهلة صلاحية 24 ساعة بالضبط =====
create table if not exists public.stories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  kind text not null check (kind in ('text','image','video')),
  text_content text,
  media_path text,
  media_mime text,
  media_iv text,
  media_key text,
  background_color text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours')
);

create table if not exists public.story_views (
  story_id uuid not null references public.stories(id) on delete cascade,
  viewer_id uuid not null,
  viewed_at timestamptz not null default now(),
  primary key (story_id, viewer_id)
);

alter table public.stories enable row level security;
alter table public.story_views enable row level security;

-- الأصدقاء بس (أو صاحب الستوري نفسه) يقدروا يشوفوا الستوري، وطول ما لسه ماخلصتش
create policy "stories: owner and friends can view unexpired"
  on public.stories for select
  using (
    expires_at > now()
    and (
      user_id = auth.uid()
      or exists (
        select 1 from public.friends f
        where f.user_id = stories.user_id and f.friend_id = auth.uid()
      )
    )
  );

create policy "stories: owner can create"
  on public.stories for insert
  with check (user_id = auth.uid());

create policy "stories: owner can delete"
  on public.stories for delete
  using (user_id = auth.uid());

create policy "story_views: owner sees viewer list, viewer sees own view"
  on public.story_views for select
  using (
    viewer_id = auth.uid()
    or exists (select 1 from public.stories s where s.id = story_views.story_id and s.user_id = auth.uid())
  );

create policy "story_views: viewer can record view"
  on public.story_views for insert
  with check (
    viewer_id = auth.uid()
    and exists (
      select 1 from public.stories s
      where s.id = story_views.story_id and s.expires_at > now()
    )
  );

create index if not exists idx_stories_user_expiry on public.stories(user_id, expires_at);

-- ===== تخزين الوسائط المشفّرة للستوري داخل نفس باكيت ephemeral-media، مسار stories/{user_id}/... =====
create policy "ephemeral media: story owner upload"
  on storage.objects for insert
  with check (
    bucket_id = 'ephemeral-media'
    and (storage.foldername(name))[1] = 'stories'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

create policy "ephemeral media: story owner and friends read"
  on storage.objects for select
  using (
    bucket_id = 'ephemeral-media'
    and (storage.foldername(name))[1] = 'stories'
    and exists (
      select 1 from public.stories s
      where s.media_path = objects.name
        and s.expires_at > now()
        and (
          s.user_id = auth.uid()
          or exists (select 1 from public.friends f where f.user_id = s.user_id and f.friend_id = auth.uid())
        )
    )
  );

-- ===== حذف تلقائي دوري (Cron) للستوريهات المنتهية + ملفاتها من التخزين =====
create or replace function public.purge_expired_stories()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from storage.objects
  where bucket_id = 'ephemeral-media'
    and name in (select media_path from public.stories where expires_at <= now() and media_path is not null);

  delete from public.stories where expires_at <= now();
end;
$$;

select cron.schedule(
  'purge-expired-stories',
  '*/10 * * * *',
  $$select public.purge_expired_stories();$$
) where not exists (select 1 from cron.job where jobname = 'purge-expired-stories');
