-- ===== إشارة WebRTC (Signaling) للمكالمات الصوتية/الفيديو — بدون أي تسجيل =====
create table if not exists public.calls (
  id uuid primary key default gen_random_uuid(),
  caller_id uuid not null,
  callee_id uuid not null,
  kind text not null check (kind in ('audio','video')),
  status text not null default 'ringing' check (status in ('ringing','accepted','declined','ended','missed')),
  created_at timestamptz not null default now(),
  ended_at timestamptz
);

create table if not exists public.call_signals (
  id bigint generated always as identity primary key,
  call_id uuid not null references public.calls(id) on delete cascade,
  sender_id uuid not null,
  signal_type text not null check (signal_type in ('offer','answer','ice-candidate','hangup')),
  payload jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.calls enable row level security;
alter table public.call_signals enable row level security;

create policy "calls: participants can view"
  on public.calls for select
  using (auth.uid() = caller_id or auth.uid() = callee_id);

create policy "calls: caller can start"
  on public.calls for insert
  with check (auth.uid() = caller_id);

create policy "calls: participants can update status"
  on public.calls for update
  using (auth.uid() = caller_id or auth.uid() = callee_id)
  with check (auth.uid() = caller_id or auth.uid() = callee_id);

create policy "call_signals: participants can view"
  on public.call_signals for select
  using (exists (
    select 1 from public.calls c
    where c.id = call_signals.call_id and (auth.uid() = c.caller_id or auth.uid() = c.callee_id)
  ));

create policy "call_signals: participants can send"
  on public.call_signals for insert
  with check (
    sender_id = auth.uid() and exists (
      select 1 from public.calls c
      where c.id = call_signals.call_id and (auth.uid() = c.caller_id or auth.uid() = c.callee_id)
    )
  );

-- ===== Push Notification device tokens (لكل جهاز) =====
create table if not exists public.device_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  token text not null unique,
  platform text not null check (platform in ('web','ios','android')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.device_tokens enable row level security;

create policy "device_tokens: owner can manage"
  on public.device_tokens for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ===== إعدادات كتم/نغمة لكل محادثة أو جروب على حدة =====
alter table public.conversations add column if not exists muted_by uuid[] not null default '{}';
alter table public.groups add column if not exists muted_by uuid[] not null default '{}';

-- ===== قفل التطبيق/المحادثة برمز أو بصمة (رمز مخزّن مشفّر Hash فقط، متزامن بين الأجهزة) =====
alter table public.profiles add column if not exists app_lock_hash text;
alter table public.profiles add column if not exists app_lock_enabled boolean not null default false;

-- ===== تشفير طرف لطرف حقيقي: تخزين المفتاح العام فقط لكل مستخدم (المفتاح الخاص يبقى على الجهاز فقط) =====
alter table public.profiles add column if not exists e2e_public_key text;

-- ===== بحث نصي أسرع داخل المحادثات والجهات =====
create extension if not exists pg_trgm;
create index if not exists idx_messages_body_trgm on public.messages using gin (body gin_trgm_ops);
create index if not exists idx_group_messages_body_trgm on public.group_messages using gin (body gin_trgm_ops);
create index if not exists idx_profiles_username_trgm on public.profiles using gin (username gin_trgm_ops);
