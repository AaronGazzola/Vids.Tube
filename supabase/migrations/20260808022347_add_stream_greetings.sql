-- Which chatters have been greeted in a broadcast is recorded rather than held
-- in worker memory: a worker restart mid-broadcast would otherwise re-greet
-- everyone who chats again. The insert happens before the send, so a rejected
-- duplicate is what prevents a second greeting.

create table if not exists public.stream_greetings (
  stream_id uuid not null references public.streams (id) on delete cascade,
  channel_id uuid not null references public.channels (id) on delete cascade,
  kind text not null check (kind in ('new', 'returning', 'batch')),
  greeted_at timestamptz not null default now(),
  primary key (stream_id, channel_id)
);

-- The primary key covers lookups by stream; channel_id needs its own index for
-- the cascade when a channel is removed.
create index if not exists stream_greetings_channel_idx
  on public.stream_greetings (channel_id);

alter table public.stream_greetings enable row level security;

-- No policies at all: greetings are written and read by the service role only.
-- Who has been greeted is worker bookkeeping, not public information.

alter table public.chat_scoring_state
  add column if not exists greet_returning boolean not null default true;
