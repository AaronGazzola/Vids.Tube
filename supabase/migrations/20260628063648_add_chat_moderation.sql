-- Chat moderation: hide messages, ban participants, AI modbot queue + manual/auto mode.

alter table public.chat_messages
  add column if not exists hidden_at timestamptz,
  add column if not exists hidden_by text;

create table if not exists public.banned_participants (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.channels (id) on delete cascade,
  participant_key text not null,
  origin text not null default 'vidstube',
  user_id uuid references auth.users (id) on delete cascade,
  external_author_id text,
  author_name text,
  reason text,
  banned_by text not null default 'owner',
  created_at timestamptz not null default now(),
  unique (channel_id, participant_key)
);

alter table public.banned_participants enable row level security;

create table if not exists public.moderation_actions (
  id uuid primary key default gen_random_uuid(),
  stream_id uuid not null references public.streams (id) on delete cascade,
  target_kind text not null,
  action text not null,
  chat_message_id uuid references public.chat_messages (id) on delete set null,
  participant_key text,
  origin text,
  user_id uuid,
  external_author_id text,
  author_name text,
  reason text,
  source text not null,
  status text not null default 'suggested',
  created_at timestamptz not null default now(),
  decided_at timestamptz
);

create index if not exists moderation_actions_stream_status_idx
  on public.moderation_actions (stream_id, status, created_at);

alter table public.moderation_actions enable row level security;

alter table public.chat_scoring_state
  add column if not exists moderation_mode text not null default 'manual';

create or replace function public.is_participant_banned(p_user uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.banned_participants
    where user_id = p_user
  );
$$;

drop policy if exists "chat messages are publicly readable" on public.chat_messages;
create policy "chat messages are publicly readable"
  on public.chat_messages
  for select
  using (hidden_at is null);

drop policy if exists "banned users cannot post" on public.chat_messages;
create policy "banned users cannot post"
  on public.chat_messages
  as restrictive
  for insert
  to authenticated
  with check (not public.is_participant_banned((select auth.uid())));
