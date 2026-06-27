create table public.stream_goals (
  stream_id uuid primary key references public.streams (id) on delete cascade,
  subs_goal int not null default 1000,
  likes_goal int not null default 500,
  viewers_goal int not null default 100,
  baseline_subs int,
  baseline_likes int,
  baseline_viewers int,
  started_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.stream_goals enable row level security;

create policy "stream goals are publicly readable"
  on public.stream_goals
  for select
  using (true);
