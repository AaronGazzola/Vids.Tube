alter table public.streams
  add column if not exists description text,
  add column if not exists thumbnail_path text;

alter table public.streams drop constraint if exists streams_status_check;

alter table public.streams
  add constraint streams_status_check
  check (status in ('idle', 'preview', 'live', 'ended'));
