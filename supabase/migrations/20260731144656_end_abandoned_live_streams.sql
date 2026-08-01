-- Auto-end abandoned live broadcasts.
--
-- A broadcast only leaves `live` when the owner presses End; a disconnect
-- deliberately keeps the row live so a reconnect resumes the same session. That
-- leaves one unrecoverable state: the owner never presses End. The stream stays
-- live forever, its finalized recording stays `processing` (both the recording
-- hook and reapStaleProcessingVods require the source stream to be `ended`), the
-- reconnect gap stays open, and the next encoder connect resumes the stale row
-- instead of starting a fresh broadcast.
--
-- This sweep ends any live broadcast whose feed has been silent past the
-- abandonment window and publishes its VOD if the recording landed. `ended_at`
-- is the last confirmed feed time, not now(): the stream's duration and the
-- live_at-anchored chat replay must reflect when the broadcast actually stopped,
-- not when the sweep noticed.
--
-- The window is 2 hours, far beyond any real disconnect/reconnect, and a
-- declared break extends it so a planned break is never cut short.
--
-- When no mp4 ever arrived the row is left `processing` on purpose:
-- reapStaleProcessingVods owns the decision to mark a recording-less VOD
-- `failed`, and ending the stream here is what finally makes that reaper
-- reachable.

create or replace function public.end_abandoned_live_streams()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window constant interval := interval '2 hours';
  v_stream record;
  v_ended_at timestamptz;
  v_count integer := 0;
begin
  for v_stream in
    select id, started_at, last_seen_at
    from public.streams
    where status = 'live'
      and coalesce(last_seen_at, started_at) < now() - v_window
      and (break_ends_at is null or break_ends_at < now() - v_window)
  loop
    v_ended_at := coalesce(v_stream.last_seen_at, v_stream.started_at, now());

    update public.stream_gaps
      set gap_end_at = greatest(gap_start_at, v_ended_at)
      where stream_id = v_stream.id
        and gap_end_at is null;

    update public.streams
      set status = 'ended',
          ended_at = v_ended_at
      where id = v_stream.id
        and status = 'live';

    update public.videos
      set status = 'ready',
          published_at = now()
      where source_stream_id = v_stream.id
        and status = 'processing'
        and mp4_path is not null;

    v_count := v_count + 1;
    raise notice 'ended abandoned live stream % (ended_at %)', v_stream.id, v_ended_at;
  end loop;

  return v_count;
end;
$$;

revoke execute on function public.end_abandoned_live_streams() from public;
revoke execute on function public.end_abandoned_live_streams() from anon;
revoke execute on function public.end_abandoned_live_streams() from authenticated;

-- Run from the database, not from request traffic: an abandoned broadcast is by
-- definition one that has stopped sending ingest heartbeats, so the in-app
-- reapers cannot be relied on to fire.
create extension if not exists pg_cron;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'end-abandoned-live-streams') then
    perform cron.unschedule('end-abandoned-live-streams');
  end if;
end
$$;

select cron.schedule(
  'end-abandoned-live-streams',
  '*/15 * * * *',
  $$select public.end_abandoned_live_streams()$$
);
