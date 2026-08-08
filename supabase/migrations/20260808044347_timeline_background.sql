-- What the stream was steadily doing, as the labelling pass understood it.
--
-- Tags are meant to mark what DEPARTS from a stream's steady state, so the steady
-- state has to be written down: without it a tag cannot be judged, and the first
-- attempt produced topics like "vibe-coding" that sit on every broadcast this
-- channel has ever made and therefore distinguish nothing.
--
-- Kept on the stream rather than in its own table because there is exactly one per
-- stream and everything that reads it already has the stream row in hand.

alter table public.streams
  add column timeline_background text;

comment on column public.streams.timeline_background is
  'The steady state of this broadcast as identified by the timeline labelling pass. Tags on its threads name departures from this.';
