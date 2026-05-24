create table public.streams (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.channels (id) on delete cascade,
  status text not null default 'idle' check (status in ('idle', 'live', 'ended')),
  title text,
  hls_path text,
  max_viewers integer not null default 25,
  started_at timestamptz,
  ended_at timestamptz,
  last_seen_at timestamptz,
  created_at timestamptz not null default now()
);

create index streams_channel_id_idx on public.streams (channel_id);
create index streams_channel_status_idx on public.streams (channel_id, status);

create table public.stream_keys (
  channel_id uuid primary key references public.channels (id) on delete cascade,
  key text not null,
  created_at timestamptz not null default now()
);

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  stream_id uuid not null references public.streams (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create index chat_messages_stream_created_idx on public.chat_messages (stream_id, created_at);

alter table public.streams enable row level security;
alter table public.stream_keys enable row level security;
alter table public.chat_messages enable row level security;

create policy "streams are publicly readable"
  on public.streams
  for select
  using (true);

create policy "owners can read their stream key"
  on public.stream_keys
  for select
  to authenticated
  using (
    exists (
      select 1 from public.channels c
      where c.id = stream_keys.channel_id
        and c.owner_user_id = (select auth.uid())
    )
  );

create policy "owners can insert their stream key"
  on public.stream_keys
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.channels c
      where c.id = stream_keys.channel_id
        and c.owner_user_id = (select auth.uid())
    )
  );

create policy "owners can update their stream key"
  on public.stream_keys
  for update
  to authenticated
  using (
    exists (
      select 1 from public.channels c
      where c.id = stream_keys.channel_id
        and c.owner_user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.channels c
      where c.id = stream_keys.channel_id
        and c.owner_user_id = (select auth.uid())
    )
  );

create policy "chat messages are publicly readable"
  on public.chat_messages
  for select
  using (true);

create policy "authenticated users can post chat messages as themselves"
  on public.chat_messages
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

alter publication supabase_realtime add table public.chat_messages;
