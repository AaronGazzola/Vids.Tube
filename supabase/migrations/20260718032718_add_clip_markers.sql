-- Viewer !clip markers: timestamped shortlist entries with transcript context
-- for cutting shorts from the VOD after the stream.

create table public.clip_markers (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.channels (id) on delete cascade,
  stream_id uuid not null references public.streams (id) on delete cascade,
  chat_message_id uuid references public.chat_messages (id) on delete set null,
  participant_key text not null,
  origin text not null check (origin in ('vidstube', 'youtube')),
  author_name text,
  stream_time_s integer not null,
  snippet text,
  created_at timestamptz not null default now()
);

create index clip_markers_stream_idx
  on public.clip_markers (stream_id, created_at);

alter table public.clip_markers enable row level security;

create policy "owners read clip markers"
  on public.clip_markers
  for select
  using (
    exists (
      select 1
      from public.channels c
      where c.id = clip_markers.channel_id
        and c.owner_user_id = auth.uid()
    )
  );

insert into public.chat_commands
  (channel_id, keyword, kind, builtin_key, description, cooldown_s, sort_order)
select c.id, 'clip', 'builtin', 'clip',
  'Mark this moment as a possible YouTube short', 60, 33
from public.channels c
on conflict (channel_id, keyword) do nothing;
