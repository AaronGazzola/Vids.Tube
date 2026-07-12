-- Waiting-room chat: let the owner open chat during a dated pre-live broadcast.

alter table public.streams
  add column if not exists waiting_room_chat boolean not null default false;

-- Gate chat posts by stream visibility: allowed when the stream is live, or when
-- it is a dated public waiting room (scheduled/preview) with waiting_room_chat on.
-- The worker's YouTube-chat inserts use the secret key and bypass RLS.
drop policy if exists "authenticated users can post chat messages as themselves"
  on public.chat_messages;

create policy "authenticated users can post chat messages as themselves"
  on public.chat_messages
  for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.streams s
      where s.id = chat_messages.stream_id
        and (
          s.status = 'live'
          or (
            s.scheduled_start_at is not null
            and s.status in ('scheduled', 'preview')
            and s.waiting_room_chat = true
          )
        )
    )
  );
