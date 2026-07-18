-- Viewer !ask exchanges: moderated, grounded Q&A with suggest/auto gating,
-- optional answer withholding, and overlay display.

create table public.ask_requests (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.channels (id) on delete cascade,
  stream_id uuid not null references public.streams (id) on delete cascade,
  chat_message_id uuid references public.chat_messages (id) on delete set null,
  participant_key text not null,
  origin text not null check (origin in ('vidstube', 'youtube')),
  author_name text,
  question text not null,
  answer text,
  reason text,
  status text not null check (status in ('suggested', 'approved', 'dismissed', 'shown')),
  include_answer boolean not null default true,
  answer_delivered_at timestamptz,
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  shown_at timestamptz
);

create index ask_requests_stream_status_idx
  on public.ask_requests (stream_id, status, approved_at);

alter table public.ask_requests enable row level security;

create policy "owners read ask requests"
  on public.ask_requests
  for select
  using (
    exists (
      select 1
      from public.channels c
      where c.id = ask_requests.channel_id
        and c.owner_user_id = auth.uid()
    )
  );

create policy "anyone reads showable asks"
  on public.ask_requests
  for select
  using (status in ('approved', 'shown'));

alter table public.chat_scoring_state
  add column if not exists ask_mode text not null default 'suggest'
    check (ask_mode in ('suggest', 'auto'));

insert into public.chat_commands
  (channel_id, keyword, kind, builtin_key, description, cooldown_s, sort_order)
select c.id, v.keyword, 'builtin', v.keyword, v.description, v.cooldown_s, v.sort_order
from public.channels c
cross join (
  values
    ('ask', 'Ask the AI about the stream or the streamer', 120, 31),
    ('catchup', 'A quick AI summary of the stream so far', 60, 32)
) as v (keyword, description, cooldown_s, sort_order)
on conflict (channel_id, keyword) do nothing;
