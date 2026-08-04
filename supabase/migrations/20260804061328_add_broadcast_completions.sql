-- What the post-broadcast pass did to a broadcast, one row per broadcast.
--
-- Recorded per step rather than as a single "done" flag: a pass where the chat
-- log could not be fetched but everything else succeeded is not the same as a
-- clean one, and the scoring run already showed what happens when those two look
-- alike — a broadcast whose every batch failed was reported as scored.
--
-- The row is also the claim. The pass writes it before doing any work, so a
-- second worker finds it and skips rather than repeating the pass.
create table if not exists public.broadcast_completions (
  stream_id uuid primary key references public.streams (id) on delete cascade,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  attempts int not null default 1,
  clean boolean not null default false,
  steps jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists broadcast_completions_clean_idx
  on public.broadcast_completions (clean);

alter table public.broadcast_completions enable row level security;

drop policy if exists "broadcast completions are publicly readable"
  on public.broadcast_completions;
create policy "broadcast completions are publicly readable"
  on public.broadcast_completions
  for select
  using (true);

revoke insert, update, delete on public.broadcast_completions from anon, authenticated;
