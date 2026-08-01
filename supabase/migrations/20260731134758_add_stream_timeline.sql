-- Stream timeline: what happened when, per stream, timestamped against the VOD.
--
-- Sections are spans about one thing and may overlap and nest freely: a long
-- "debugging the deploy" section can contain a short "argument about mustaches"
-- and both are real rows. Moments are points where something specific happened.
-- Chapters are the one flat non-overlapping spine derived from the same pass.
--
-- Timestamps are stream-relative seconds, matching transcript_segments and
-- youtube_transcripts so timeline rows join to transcript rows without a units
-- conversion.

create table public.stream_sections (
  id uuid primary key default gen_random_uuid(),
  stream_id uuid not null references public.streams (id) on delete cascade,
  start_s double precision not null check (start_s >= 0),
  end_s double precision check (end_s is null or end_s >= start_s),
  label text not null check (length(trim(label)) > 0),
  summary text not null,
  tags text[] not null default '{}',
  scores jsonb not null,
  prompt_version text not null,
  created_at timestamptz not null default now(),
  constraint stream_sections_scores_valid check (
    jsonb_typeof(scores -> 'humour') = 'number'
    and jsonb_typeof(scores -> 'interest') = 'number'
    and jsonb_typeof(scores -> 'engagement') = 'number'
    and (scores ->> 'humour')::numeric between 0 and 100
    and (scores ->> 'interest')::numeric between 0 and 100
    and (scores ->> 'engagement')::numeric between 0 and 100
  )
);

create table public.stream_moments (
  id uuid primary key default gen_random_uuid(),
  stream_id uuid not null references public.streams (id) on delete cascade,
  start_s double precision not null check (start_s >= 0),
  end_s double precision not null check (end_s >= start_s),
  kind text not null check (length(trim(kind)) > 0),
  label text not null check (length(trim(label)) > 0),
  summary text not null,
  tags text[] not null default '{}',
  scores jsonb not null,
  prompt_version text not null,
  created_at timestamptz not null default now(),
  constraint stream_moments_scores_valid check (
    jsonb_typeof(scores -> 'humour') = 'number'
    and jsonb_typeof(scores -> 'interest') = 'number'
    and jsonb_typeof(scores -> 'engagement') = 'number'
    and (scores ->> 'humour')::numeric between 0 and 100
    and (scores ->> 'interest')::numeric between 0 and 100
    and (scores ->> 'engagement')::numeric between 0 and 100
  )
);

-- Chapters carry no scores: they are a navigation spine, not a ranked candidate.
create table public.stream_chapters (
  id uuid primary key default gen_random_uuid(),
  stream_id uuid not null references public.streams (id) on delete cascade,
  start_s double precision not null check (start_s >= 0),
  title text not null check (length(trim(title)) > 0),
  status text not null default 'suggested'
    check (status in ('suggested', 'approved')),
  prompt_version text not null,
  created_at timestamptz not null default now(),
  unique (stream_id, start_s)
);

create index stream_sections_stream_start_idx
  on public.stream_sections (stream_id, start_s);

create index stream_moments_stream_start_idx
  on public.stream_moments (stream_id, start_s);

create index stream_chapters_stream_start_idx
  on public.stream_chapters (stream_id, start_s);

create index stream_sections_tags_idx
  on public.stream_sections using gin (tags);

create index stream_moments_tags_idx
  on public.stream_moments using gin (tags);

alter table public.stream_sections enable row level security;
alter table public.stream_moments enable row level security;
alter table public.stream_chapters enable row level security;

create policy "stream sections are publicly readable"
  on public.stream_sections
  for select
  using (true);

create policy "stream moments are publicly readable"
  on public.stream_moments
  for select
  using (true);

create policy "stream chapters are publicly readable"
  on public.stream_chapters
  for select
  using (true);
