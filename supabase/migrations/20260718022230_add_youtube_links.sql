-- Lightweight YouTube identity link: a user claims a handle, resolved to a
-- channel id server-side, and proves ownership by posting a code in the
-- owner's YouTube live chat from that channel. No OAuth involved.

create table public.youtube_links (
  user_id uuid primary key references auth.users (id) on delete cascade,
  youtube_channel_id text not null,
  youtube_handle text not null,
  verify_code text not null,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index youtube_links_channel_idx
  on public.youtube_links (youtube_channel_id);

alter table public.youtube_links enable row level security;

-- Reads are self-only; every write goes through auth-checked server actions
-- using the service role so verified_at cannot be self-set.
create policy "users read their own youtube link"
  on public.youtube_links
  for select
  using (user_id = (select auth.uid()));
