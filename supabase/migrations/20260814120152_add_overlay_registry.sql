-- The overlay platform's first foundation piece: a framed overlay becomes a row
-- with an id and an owner, and a channel installs it. Until now the one framed
-- overlay was a build-time environment variable, which carries one streamer's
-- whole configuration and therefore cannot serve a second streamer.
--
-- Only framed overlays get rows here. The built-in overlays (highlights, goals,
-- competition, banner) are first-party React inside the stage and are not
-- registry entries; `overlay_layouts` remains where a channel's box positions
-- live, and is a different noun from this.

create table public.overlays (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug = lower(slug) and slug ~ '^[a-z0-9-]+$'),
  name text not null,
  -- Null means first-party. It is not a missing value: a first-party overlay has
  -- no third-party owner, and the absence grants it nothing another row lacks.
  owner_user_id uuid references auth.users (id) on delete set null,
  entry_url text not null,
  status text not null default 'draft' check (status in ('draft', 'published', 'disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.overlays enable row level security;

-- Published rows are public in the same way enabled chat commands are: the
-- install list and the unauthenticated overlay route both read them. Writes go
-- through owner-checked server actions on the service role.
create policy "anyone can read published overlays"
  on public.overlays
  for select
  using (status = 'published');

create table public.channel_overlays (
  -- This id is the per-channel identity of the overlay. It is appended to the
  -- framed address so two channels running the same overlay frame two different
  -- addresses. It names an installation and grants nothing on its own; the
  -- short-lived signed token that replaces it in the URL is what will grant.
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.channels (id) on delete cascade,
  overlay_id uuid not null references public.overlays (id) on delete cascade,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  unique (channel_id, overlay_id)
);

alter table public.channel_overlays enable row level security;

create policy "owners read their installations"
  on public.channel_overlays
  for select
  using (
    exists (
      select 1
      from public.channels c
      where c.id = channel_overlays.channel_id
        and c.owner_user_id = auth.uid()
    )
  );

create policy "owners install overlays on their channel"
  on public.channel_overlays
  for insert
  with check (
    exists (
      select 1
      from public.channels c
      where c.id = channel_overlays.channel_id
        and c.owner_user_id = auth.uid()
    )
  );

create policy "owners change their installations"
  on public.channel_overlays
  for update
  using (
    exists (
      select 1
      from public.channels c
      where c.id = channel_overlays.channel_id
        and c.owner_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.channels c
      where c.id = channel_overlays.channel_id
        and c.owner_user_id = auth.uid()
    )
  );

create policy "owners remove their installations"
  on public.channel_overlays
  for delete
  using (
    exists (
      select 1
      from public.channels c
      where c.id = channel_overlays.channel_id
        and c.owner_user_id = auth.uid()
    )
  );
