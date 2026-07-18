-- Viewer !tts requests: moderated, suggest/auto gated, synthesized to the
-- public tts bucket, and played serially by the highlight overlay.

create table public.tts_requests (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.channels (id) on delete cascade,
  stream_id uuid not null references public.streams (id) on delete cascade,
  chat_message_id uuid references public.chat_messages (id) on delete set null,
  participant_key text not null,
  origin text not null check (origin in ('vidstube', 'youtube')),
  author_name text,
  text text not null,
  status text not null check (status in ('suggested', 'approved', 'dismissed', 'played')),
  reason text,
  audio_path text,
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  played_at timestamptz
);

create index tts_requests_stream_status_idx
  on public.tts_requests (stream_id, status, approved_at);

alter table public.tts_requests enable row level security;

create policy "owners read tts requests"
  on public.tts_requests
  for select
  using (
    exists (
      select 1
      from public.channels c
      where c.id = tts_requests.channel_id
        and c.owner_user_id = auth.uid()
    )
  );

-- The overlay browser source is unauthenticated; it only needs playable rows.
create policy "anyone reads playable tts"
  on public.tts_requests
  for select
  using (status in ('approved', 'played'));

alter table public.chat_scoring_state
  add column if not exists tts_mode text not null default 'suggest'
    check (tts_mode in ('suggest', 'auto'));

insert into public.chat_commands
  (channel_id, keyword, kind, builtin_key, description, cooldown_s, max_per_stream, sort_order)
select c.id, 'tts', 'builtin', 'tts',
  'Have your message spoken on stream (moderated)', 180, 5, 30
from public.channels c
on conflict (channel_id, keyword) do nothing;

insert into storage.buckets (id, name, public)
values ('tts', 'tts', true)
on conflict (id) do nothing;
