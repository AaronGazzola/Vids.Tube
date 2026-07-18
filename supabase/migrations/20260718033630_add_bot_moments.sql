-- Proactive bot moments + owner-fired wrap-up, and the channel projects list
-- that feeds progress updates, wrap-up links, and !ask grounding.

create table public.channel_projects (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.channels (id) on delete cascade,
  name text not null,
  blurb text,
  domain_url text,
  repo_url text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.channel_projects enable row level security;

-- Project facts feed public bot messages, so public read is harmless; writes
-- go through owner-checked server actions with the service role.
create policy "anyone reads channel projects"
  on public.channel_projects
  for select
  using (true);

alter table public.chat_scoring_state
  add column if not exists useful_info_enabled boolean not null default false,
  add column if not exists competition_status_enabled boolean not null default false,
  add column if not exists progress_update_enabled boolean not null default false,
  add column if not exists wrapup_mvp_enabled boolean not null default true,
  add column if not exists wrapup_summary_enabled boolean not null default true,
  add column if not exists wrapup_thanks_enabled boolean not null default true;

alter table public.streams
  add column if not exists wrapup_requested_at timestamptz,
  add column if not exists wrapup_done_at timestamptz;
