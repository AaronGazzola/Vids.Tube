-- AZ-168 (code-first verification): a signed-in user gets a unique verify code
-- with no handle typed up front. The worker learns the YouTube channel id and
-- handle from whoever posts the code in chat, then verifies and links.
alter table public.youtube_links
  alter column youtube_channel_id drop not null,
  alter column youtube_handle drop not null;

create unique index if not exists youtube_links_verify_code_key
  on public.youtube_links (verify_code);
