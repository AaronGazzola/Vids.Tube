create table public.transcript_segments (
  id uuid primary key default gen_random_uuid(),
  stream_id uuid not null references public.streams (id) on delete cascade,
  start_s double precision not null,
  end_s double precision not null,
  text text not null,
  created_at timestamptz not null default now()
);

create index transcript_segments_stream_start_idx
  on public.transcript_segments (stream_id, start_s);

alter table public.transcript_segments enable row level security;

create policy "transcript segments are publicly readable"
  on public.transcript_segments
  for select
  using (true);
