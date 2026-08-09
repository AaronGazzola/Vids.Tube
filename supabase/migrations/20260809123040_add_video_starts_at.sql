-- The wall-clock instant a recording's file begins.
--
-- Chat replay anchors on the broadcast's go-live time and assumes the file
-- starts there. That assumption has never been true for a broadcast recorded
-- before go-live, which is why replay on the 8-Aug-2026 broadcast sits about 45
-- minutes out, and it stops being true in a new way the moment a file is
-- replaced by one that begins somewhere else.
--
-- Recording where the file actually begins removes the assumption. Null means
-- "unknown, carry on assuming go-live", so every existing recording behaves
-- exactly as it does today.

alter table public.videos
  add column starts_at timestamptz;

comment on column public.videos.starts_at is
  'Wall-clock instant the file begins. Null means unknown, and replay falls back to the broadcast go-live time. Set when a recording is trimmed or replaced.';
