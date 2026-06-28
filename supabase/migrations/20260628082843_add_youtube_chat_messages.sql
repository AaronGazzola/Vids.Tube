-- Store YouTube live chat alongside Vids.Tube chat (cross-origin chat_messages).

alter table public.chat_messages
  alter column user_id drop not null,
  add column if not exists origin text not null default 'vidstube',
  add column if not exists external_author_id text,
  add column if not exists author_name text,
  add column if not exists author_avatar_url text,
  add column if not exists external_message_id text;

create unique index if not exists chat_messages_stream_ext_msg_uidx
  on public.chat_messages (stream_id, external_message_id)
  where external_message_id is not null;
