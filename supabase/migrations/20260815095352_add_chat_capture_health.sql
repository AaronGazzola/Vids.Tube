-- Whether YouTube chat capture is still working, and where a stored message
-- came from.
--
-- On 9-Aug-2026 the live chat reader stopped at 13:58 of a broadcast that ran to
-- 14:59. The worker kept its lock, its heartbeat, its scoring and its commands
-- the whole time, so nothing the app watched could tell the difference. These
-- two columns are what make that difference visible.

-- Stamped from a successful page read rather than from an arriving message: a
-- chat with nobody speaking is not a fault and must not be reported as one.
alter table public.streams
  add column if not exists youtube_chat_polled_at timestamptz;

comment on column public.streams.youtube_chat_polled_at is
  'Last successful YouTube live chat page read for this broadcast. Stale while a broadcast is live means capture has stalled, whatever the worker heartbeat says.';

-- Live capture and the replay top-up insert rows of the same shape, and nothing
-- records insertion time, so after a top-up the two are indistinguishable.
-- Without this column, how much live capture actually achieved is unanswerable
-- for every broadcast that has already been repaired.
alter table public.chat_messages
  add column if not exists captured_via text not null default 'live';

alter table public.chat_messages
  drop constraint if exists chat_messages_captured_via_check;
alter table public.chat_messages
  add constraint chat_messages_captured_via_check
  check (captured_via in ('live', 'replay'));

comment on column public.chat_messages.captured_via is
  'How the message came to be stored: live capture during the broadcast, or the platform chat replay afterwards. Rows predating this column carry the default, so broadcasts repaired before 15-Aug-2026 overstate what live capture achieved. Any report reading this column must say so.';

create index if not exists chat_messages_stream_captured_via_idx
  on public.chat_messages (stream_id, captured_via);
