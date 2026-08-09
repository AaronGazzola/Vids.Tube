-- Applies a recording swap as one transaction.
--
-- The first attempt shifted timings row by row from the client and then updated
-- the recording, which is not one operation however it is written. Two faults
-- landed at once: the read of the segments to shift silently returned only the
-- first 1,000 of 1,222, and the recording update then failed on a fractional
-- duration. The result was a broadcast whose transcript was partly shifted and
-- whose recording still pointed at the old file.
--
-- Doing the whole thing in the database removes the possibility. Every shift
-- and the recording update either all happen or none do, no read can be
-- truncated because nothing is read out, and one round trip replaces 1,222.

create or replace function public.apply_recording_swap(
  p_stream uuid,
  p_video uuid,
  p_offset double precision,
  p_mp4_path text,
  p_duration_s integer,
  p_starts_at timestamptz
)
returns table (
  segments_shifted integer,
  spans_shifted integer,
  moments_shifted integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_segments integer;
  v_spans integer;
  v_moments integer;
begin
  update public.transcript_segments
  set start_s = start_s - p_offset,
      end_s = end_s - p_offset
  where stream_id = p_stream;
  get diagnostics v_segments = row_count;

  update public.stream_thread_spans
  set start_s = start_s - p_offset,
      end_s = end_s - p_offset
  where stream_id = p_stream;
  get diagnostics v_spans = row_count;

  update public.stream_moments
  set start_s = start_s - p_offset,
      end_s = end_s - p_offset,
      peak_s = peak_s - p_offset
  where stream_id = p_stream;
  get diagnostics v_moments = row_count;

  update public.videos
  set mp4_path = p_mp4_path,
      duration_s = p_duration_s,
      starts_at = p_starts_at,
      visibility = 'private',
      status = 'ready'
  where id = p_video;

  if not found then
    raise exception 'no recording % to swap', p_video;
  end if;

  return query select v_segments, v_spans, v_moments;
end;
$$;

-- Only the service key ever calls this. It rewrites a broadcast's timings, so
-- no signed-in user has any business reaching it.
revoke execute on function public.apply_recording_swap(
  uuid, uuid, double precision, text, integer, timestamptz
) from anon, authenticated;
