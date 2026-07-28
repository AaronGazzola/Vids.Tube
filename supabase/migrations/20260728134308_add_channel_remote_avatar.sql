-- AZ-170: durable cached avatar for channels (relative R2 key served via the
-- public VOD base URL). Uploaded Supabase branding avatar_path still wins.
alter table public.channels
  add column if not exists remote_avatar_path text;
