create table public.videos (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.channels (id) on delete cascade,
  source_stream_id uuid references public.streams (id) on delete set null,
  status text not null default 'processing' check (status in ('processing', 'ready', 'failed')),
  title text,
  mp4_path text,
  thumbnail_path text,
  duration_s integer,
  published_at timestamptz,
  created_at timestamptz not null default now()
);

create index videos_channel_published_idx on public.videos (channel_id, published_at desc);
create index videos_source_stream_idx on public.videos (source_stream_id);

alter table public.videos enable row level security;

create policy "ready videos are publicly readable"
  on public.videos
  for select
  using (status = 'ready');
