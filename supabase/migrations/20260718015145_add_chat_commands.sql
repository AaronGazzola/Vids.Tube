-- Chat "!" command layer: a per-channel registry with tunable limits, and an
-- execution log that doubles as the cooldown/total accounting source of truth.

create table public.chat_commands (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.channels (id) on delete cascade,
  keyword text not null check (keyword = lower(keyword) and keyword ~ '^[a-z0-9_]+$'),
  kind text not null check (kind in ('builtin', 'custom')),
  builtin_key text,
  description text not null,
  response text,
  cooldown_s integer not null default 30 check (cooldown_s >= 0),
  max_per_stream integer check (max_per_stream > 0),
  enabled boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (channel_id, keyword)
);

alter table public.chat_commands enable row level security;

-- The public command guide page lists enabled commands; management writes go
-- through owner-checked server actions using the service role.
create policy "anyone can read enabled commands"
  on public.chat_commands
  for select
  using (enabled = true);

create table public.command_events (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.channels (id) on delete cascade,
  stream_id uuid not null references public.streams (id) on delete cascade,
  chat_message_id uuid references public.chat_messages (id) on delete set null,
  origin text not null check (origin in ('vidstube', 'youtube')),
  participant_key text not null,
  keyword text not null,
  args text,
  status text not null check (status in ('executed', 'cooldown', 'limit', 'disabled', 'unknown')),
  reply text,
  created_at timestamptz not null default now()
);

create index command_events_limit_lookup_idx
  on public.command_events (stream_id, participant_key, keyword, created_at);

alter table public.command_events enable row level security;

create policy "owners read their command events"
  on public.command_events
  for select
  using (
    exists (
      select 1
      from public.channels c
      where c.id = command_events.channel_id
        and c.owner_user_id = auth.uid()
    )
  );

-- Seed the help builtin for every existing channel.
insert into public.chat_commands
  (channel_id, keyword, kind, builtin_key, description, cooldown_s, sort_order)
select c.id, 'help', 'builtin', 'help', 'List the available chat commands', 30, 0
from public.channels c
on conflict (channel_id, keyword) do nothing;
