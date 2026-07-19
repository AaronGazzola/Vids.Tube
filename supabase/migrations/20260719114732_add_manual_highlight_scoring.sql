alter table public.featured_messages
  add column scored_at timestamptz;

update public.featured_messages
  set scored_at = featured_at;

alter table public.chat_messages
  add column scored_at timestamptz;

update public.chat_messages
  set scored_at = created_at;

create index featured_messages_stream_unscored_idx
  on public.featured_messages (stream_id)
  where scored_at is null;
