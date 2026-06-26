create table public.featured_messages (
  id uuid primary key default gen_random_uuid(),
  stream_id uuid not null references public.streams (id) on delete cascade,
  chat_message_id uuid not null unique references public.chat_messages (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  score int not null,
  categories text[] not null default '{}',
  reason text,
  ring_level int not null default 1,
  featured_at timestamptz not null default now()
);

create index featured_messages_stream_featured_idx
  on public.featured_messages (stream_id, featured_at);

create table public.viewer_scores (
  stream_id uuid not null references public.streams (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  total_score int not null default 0,
  features_count int not null default 0,
  last_featured_at timestamptz,
  primary key (stream_id, user_id)
);

create table public.score_events (
  id uuid primary key default gen_random_uuid(),
  stream_id uuid not null references public.streams (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null,
  points int not null default 0,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index score_events_stream_user_created_idx
  on public.score_events (stream_id, user_id, created_at);

create table public.chat_scoring_state (
  stream_id uuid primary key references public.streams (id) on delete cascade,
  last_scored_at timestamptz,
  enabled boolean not null default false,
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.featured_messages enable row level security;
alter table public.viewer_scores enable row level security;
alter table public.score_events enable row level security;
alter table public.chat_scoring_state enable row level security;

create policy "featured messages are publicly readable"
  on public.featured_messages
  for select
  using (true);

create policy "viewer scores are publicly readable"
  on public.viewer_scores
  for select
  using (true);

create policy "score events are publicly readable"
  on public.score_events
  for select
  using (true);

create policy "chat scoring state is publicly readable"
  on public.chat_scoring_state
  for select
  using (true);

alter publication supabase_realtime add table public.featured_messages;
