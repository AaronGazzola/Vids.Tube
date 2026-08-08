-- Chatter-selectable TTS voices. The voice is resolved when the request is
-- queued, not when the audio is made: synthesis happens a scoring pass later,
-- by which time the chatter's sticky voice may have moved on.
--
-- The sticky voice is "the chatter's most recent request that carried a voice",
-- so this column is also the store. merge_youtube_identity already rewrites
-- tts_requests.participant_key on linking, which carries past picks across the
-- YouTube/Vids.Tube identity split for free.

alter table public.tts_requests
  add column if not exists voice text;

create index if not exists tts_requests_sticky_voice_idx
  on public.tts_requests (channel_id, participant_key, created_at desc)
  where voice is not null;

insert into public.chat_commands
  (channel_id, keyword, kind, builtin_key, description, cooldown_s, sort_order)
select c.id, 'voices', 'builtin', 'voices',
  'List the TTS voices and show which one is yours', 60, 31
from public.channels c
on conflict (channel_id, keyword) do nothing;

update public.chat_commands
   set description = 'Have your message spoken on stream (moderated) — !tts <voice> your message'
 where keyword = 'tts'
   and kind = 'builtin';
