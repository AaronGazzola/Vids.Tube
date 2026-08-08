-- Subject identity separates from time.
--
-- A section was a single contiguous span whose only identity was its text, so two
-- spans about the same subject were unrelated rows and a subject that came back
-- later could not be expressed. A thread is the subject and carries no time; a span
-- is one appearance of it. Fusing a thread's spans into one sequence is what a
-- shorts workflow reads, and it is not expressible over sections at all.
--
-- Sections are dropped rather than migrated: one broadcast of 168 is labelled, and
-- its rows carry none of the relatedness the new model exists to record.

drop index if exists public.stream_sections_tags_idx;
drop index if exists public.stream_sections_stream_start_idx;
drop table if exists public.stream_sections;

create table public.stream_threads (
  id uuid primary key default gen_random_uuid(),
  stream_id uuid not null references public.streams (id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  summary text not null,
  tags text[] not null default '{}',
  scores jsonb not null,
  prompt_version text not null,
  created_at timestamptz not null default now(),
  constraint stream_threads_scores_valid check (
    jsonb_typeof(scores -> 'humour') = 'number'
    and jsonb_typeof(scores -> 'interest') = 'number'
    and jsonb_typeof(scores -> 'engagement') = 'number'
    and (scores ->> 'humour')::numeric between 0 and 100
    and (scores ->> 'interest')::numeric between 0 and 100
    and (scores ->> 'engagement')::numeric between 0 and 100
  )
);

-- stream_id is redundant against thread_id and is carried anyway: the map reads one
-- stream with a single query per table, and the backfill clears a stream with one
-- delete per table rather than a join.
--
-- ordinal fixes the playback order explicitly. It is chronological today, but
-- reordering a thread's spans is the next thing a shorts editor does, and storing it
-- now costs one integer.
create table public.stream_thread_spans (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.stream_threads (id) on delete cascade,
  stream_id uuid not null references public.streams (id) on delete cascade,
  start_s double precision not null check (start_s >= 0),
  end_s double precision not null check (end_s >= start_s),
  label text not null check (length(trim(label)) > 0),
  ordinal integer not null check (ordinal >= 0),
  scores jsonb not null,
  created_at timestamptz not null default now(),
  unique (thread_id, ordinal),
  constraint stream_thread_spans_scores_valid check (
    jsonb_typeof(scores -> 'humour') = 'number'
    and jsonb_typeof(scores -> 'interest') = 'number'
    and jsonb_typeof(scores -> 'engagement') = 'number'
    and (scores ->> 'humour')::numeric between 0 and 100
    and (scores ->> 'interest')::numeric between 0 and 100
    and (scores ->> 'engagement')::numeric between 0 and 100
  )
);

-- A moment becomes a window a clip can be cut from, with the peak marking where the
-- thing actually happens. Half the existing rows have no duration and cannot satisfy
-- that, so they go with the sections they were labelled alongside.
delete from public.stream_moments;

alter table public.stream_moments
  add column peak_s double precision not null,
  add column thread_id uuid references public.stream_threads (id) on delete set null,
  drop constraint if exists stream_moments_end_s_check,
  add constraint stream_moments_window_valid check (
    end_s > start_s and peak_s >= start_s and peak_s <= end_s
  );

create index stream_threads_stream_idx on public.stream_threads (stream_id);
create index stream_threads_tags_idx on public.stream_threads using gin (tags);
create index stream_thread_spans_stream_start_idx
  on public.stream_thread_spans (stream_id, start_s);
create index stream_thread_spans_thread_ordinal_idx
  on public.stream_thread_spans (thread_id, ordinal);
create index stream_moments_stream_thread_idx
  on public.stream_moments (stream_id, thread_id);

alter table public.stream_threads enable row level security;
alter table public.stream_thread_spans enable row level security;

create policy "stream threads are publicly readable"
  on public.stream_threads
  for select
  using (true);

create policy "stream thread spans are publicly readable"
  on public.stream_thread_spans
  for select
  using (true);
