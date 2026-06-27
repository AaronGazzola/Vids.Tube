alter table public.streams
  add column if not exists youtube_video_id text,
  add column if not exists youtube_channel_id text;
