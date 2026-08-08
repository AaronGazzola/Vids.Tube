alter table public.channels
  add column if not exists avatar_source_url text;

comment on column public.channels.avatar_source_url is
  'YouTube avatar URL the cached copy in remote_avatar_path was made from. A changed avatar gets a new URL, so a mismatch means the cached copy is stale.';
