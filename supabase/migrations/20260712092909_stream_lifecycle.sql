-- Stream lifecycle: private draft state, go-live marker, ad-hoc discriminator,
-- and a single-active-stream guarantee per channel.

alter table public.streams
  add column if not exists live_at timestamptz,
  add column if not exists created_in_ui boolean not null default false;

alter table public.streams drop constraint if exists streams_status_check;

alter table public.streams
  add constraint streams_status_check
  check (status in ('idle', 'draft', 'scheduled', 'preview', 'live', 'ended'));

-- At most one active stream per channel. "Active" = configured/connected but not
-- yet ended. The create-then-claim flow and the /live page both target this row.
create unique index if not exists streams_channel_active_uidx
  on public.streams (channel_id)
  where status in ('draft', 'scheduled', 'preview', 'live');
