-- YouTube view/like counts captured once at import time by the VOD importer,
-- so engagement stats from the YouTube era are preserved on vids.tube.

alter table public.youtube_vods
  add column view_count integer,
  add column like_count integer;
