-- Local worker heartbeat: the worker upserts its channel row every tick so the
-- /live page can show a running/stopped indicator and schedule-save can warn
-- when the worker is unreachable.

create table if not exists public.worker_heartbeats (
  channel_id uuid primary key references public.channels (id) on delete cascade,
  last_heartbeat_at timestamptz not null default now()
);

alter table public.worker_heartbeats enable row level security;

-- Owner-readable; the worker writes with the secret key (bypasses RLS).
create policy "owners can read their worker heartbeat"
  on public.worker_heartbeats
  for select
  to authenticated
  using (
    exists (
      select 1 from public.channels c
      where c.id = worker_heartbeats.channel_id
        and c.owner_user_id = (select auth.uid())
    )
  );
