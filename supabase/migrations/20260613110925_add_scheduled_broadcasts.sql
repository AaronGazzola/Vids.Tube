alter table public.streams
  add column if not exists scheduled_start_at timestamptz;

alter table public.streams drop constraint if exists streams_status_check;

alter table public.streams
  add constraint streams_status_check
  check (status in ('idle', 'scheduled', 'preview', 'live', 'ended'));

create index if not exists streams_channel_scheduled_idx
  on public.streams (channel_id, scheduled_start_at)
  where status = 'scheduled';
