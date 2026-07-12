-- Reconnect gaps: each encoder disconnect during a live broadcast opens a gap
-- (closed on reconnect or at End). The VOD jump-cuts over these; chat replay uses
-- them to stay in sync across the cuts.

create table public.stream_gaps (
  id uuid primary key default gen_random_uuid(),
  stream_id uuid not null references public.streams (id) on delete cascade,
  gap_start_at timestamptz not null default now(),
  gap_end_at timestamptz
);

create index stream_gaps_stream_idx
  on public.stream_gaps (stream_id, gap_start_at);

-- At most one open gap per stream (a repeated not-ready must not open a second).
create unique index stream_gaps_one_open_uidx
  on public.stream_gaps (stream_id)
  where gap_end_at is null;

alter table public.stream_gaps enable row level security;

create policy "stream gaps are publicly readable"
  on public.stream_gaps
  for select
  using (true);
