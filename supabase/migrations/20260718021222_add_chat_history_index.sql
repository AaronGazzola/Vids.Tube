-- Historical YouTube chat archive: raw replayed messages per VOD plus
-- per-chatter aggregates, keyed by the same author channel id live chat
-- carries. Owner-read only; written by the owner-run backfill script.

create table public.youtube_vods (
  video_id text primary key,
  title text,
  published_at timestamptz,
  message_count integer not null default 0,
  backfilled_at timestamptz not null default now()
);

create table public.youtube_chat_archive (
  id uuid primary key default gen_random_uuid(),
  video_id text not null references public.youtube_vods (video_id) on delete cascade,
  message_id text not null,
  author_channel_id text not null,
  author_name text,
  body text not null,
  published_at timestamptz not null,
  unique (video_id, message_id)
);

create index youtube_chat_archive_author_idx
  on public.youtube_chat_archive (author_channel_id);

create table public.chatter_stats (
  author_channel_id text primary key,
  author_name text,
  total_messages integer not null default 0,
  videos_attended integer not null default 0,
  first_seen_at timestamptz,
  last_seen_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.youtube_vods enable row level security;
alter table public.youtube_chat_archive enable row level security;
alter table public.chatter_stats enable row level security;

create policy "owners read youtube vods"
  on public.youtube_vods
  for select
  using (
    exists (
      select 1
      from public.channels c
      where c.owner_user_id = auth.uid()
    )
  );

create policy "owners read the chat archive"
  on public.youtube_chat_archive
  for select
  using (
    exists (
      select 1
      from public.channels c
      where c.owner_user_id = auth.uid()
    )
  );

create policy "owners read chatter stats"
  on public.chatter_stats
  for select
  using (
    exists (
      select 1
      from public.channels c
      where c.owner_user_id = auth.uid()
    )
  );
