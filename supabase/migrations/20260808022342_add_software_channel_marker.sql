-- Nightbot holds a membership with 75 messages, because every VidsBot line is
-- delivered through the Nightbot account and is therefore stored under
-- Nightbot's YouTube identity. A public member count and a public leaderboard
-- cannot include it.
--
-- The marker is explicit per channel and is never inferred from a name: RigBot,
-- in this database, is a real viewer whose single message reads "hii".

alter table public.channels
  add column if not exists is_software boolean not null default false;

-- Channel owners may update their own row, so the column is closed at the
-- privilege level rather than left to the row policy: nobody excludes
-- themselves from the member count by editing their own channel.
revoke update (is_software) on public.channels from anon, authenticated;

create index if not exists channels_is_software_idx
  on public.channels (is_software)
  where is_software;

update public.channels
   set is_software = true
 where youtube_channel_id = 'UCSvjQBDgYDB5TGVmCZObcwA';
