-- Which rubric produced a rating. Nullable so the ratings written before the
-- scoring configuration existed stay valid; the backfill stamps everything it
-- writes, and the live scorer stamps from here on.
alter table public.score_events
  add column if not exists scoring_version text;

create index if not exists score_events_stream_version_idx
  on public.score_events (stream_id, scoring_version);
