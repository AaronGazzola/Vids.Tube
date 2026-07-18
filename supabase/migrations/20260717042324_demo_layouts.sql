-- Per-channel demo overlay layout for the /live Demo switch: overlay box
-- positions/scales, per-overlay visibility, goal-progress state, and background
-- choice. One row per channel. Read/written only by the owner via server actions.

create table public.demo_layouts (
  channel_id uuid primary key references public.channels (id) on delete cascade,
  config jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

alter table public.demo_layouts enable row level security;

-- Owner-only read; writes go through the service role in owner-checked actions.
create policy "owners read their demo layout"
  on public.demo_layouts
  for select
  using (
    exists (
      select 1
      from public.channels c
      where c.id = demo_layouts.channel_id
        and c.owner_user_id = auth.uid()
    )
  );
