alter table public.featured_messages
  alter column user_id drop not null,
  alter column chat_message_id drop not null,
  add column origin text not null default 'vidstube',
  add column external_author_id text,
  add column author_name text,
  add column author_avatar_url text,
  add constraint featured_messages_origin_check
    check (origin in ('vidstube', 'youtube'));

alter table public.score_events
  alter column user_id drop not null,
  add column origin text not null default 'vidstube',
  add column external_author_id text,
  add constraint score_events_origin_check
    check (origin in ('vidstube', 'youtube'));

alter table public.viewer_scores drop constraint viewer_scores_pkey;

alter table public.viewer_scores
  add column origin text not null default 'vidstube',
  add column external_author_id text,
  add column author_name text,
  add column author_avatar_url text,
  alter column user_id drop not null,
  add constraint viewer_scores_origin_check
    check (origin in ('vidstube', 'youtube'));

alter table public.viewer_scores
  add column participant_key text generated always as (
    coalesce(user_id::text, origin || ':' || external_author_id)
  ) stored;

alter table public.viewer_scores add primary key (stream_id, participant_key);
