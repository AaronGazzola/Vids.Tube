-- Visibility, held apart from processing state.
--
-- Hiding a recording was previously done by writing 'failed' onto it, which is
-- the same mark a recording carries when processing genuinely broke. The two
-- questions are independent: a recording can be private and ready, or public
-- and still processing.

alter table public.videos
  add column visibility text not null default 'public'
  check (visibility in ('public', 'unlisted', 'private'));

-- Everything already published stays published. Any other default would hide
-- recordings that are visible today.
update public.videos set visibility = 'public';

-- The 8-Aug-2026 broadcast is the one exception, and the one row whose status
-- is a lie: it processed cleanly and was marked failed only in order to hide an
-- email address shown on screen. Visibility now says what was meant, and the
-- status is corrected to what actually happened.
update public.videos v
set visibility = 'private',
    status = 'ready'
from public.streams s
where s.id = v.source_stream_id
  and s.started_at >= '2026-08-08'::date
  and s.started_at < '2026-08-09'::date
  and v.status = 'failed';

create index if not exists videos_visibility_idx
  on public.videos (channel_id, visibility, status);

-- An unlisted recording stays readable, so it can be reached by its own
-- address; it is kept out of listings by the queries that build them, not by
-- this policy. A private recording is readable only by the channel owner, and
-- every other reader gets no row rather than an error, so its existence is not
-- disclosed.
drop policy if exists "ready videos are publicly readable" on public.videos;

create policy "ready videos are readable subject to visibility"
  on public.videos
  for select
  using (
    status = 'ready'
    and (
      visibility in ('public', 'unlisted')
      or exists (
        select 1
        from public.channels c
        where c.id = videos.channel_id
          and c.owner_user_id = (select auth.uid())
      )
    )
  );

-- No UPDATE policy exists on this table and none is added here, so no client
-- can write visibility at all. The only writer is a server action holding the
-- service key, and that action checks channel ownership before writing. Adding
-- an owner-only trigger here would fire for the service role too, whose
-- auth.uid() is null, and would block the legitimate writer while protecting
-- against a path that does not exist.
