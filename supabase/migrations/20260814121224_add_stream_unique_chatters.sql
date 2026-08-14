-- How many different people spoke during one broadcast.
--
-- Counted from the chat itself rather than from any aggregate, so it is true
-- while the broadcast is running rather than only after the post-broadcast pass
-- has rebuilt things. A participant is identified the way the rest of the app
-- identifies one: the signed-in user where there is one, otherwise the origin
-- and the external author id together, so the same person chatting from YouTube
-- and from the site is not counted twice under one identity and is not merged
-- across two.
create or replace function public.stream_unique_chatters(p_stream uuid)
returns int
language sql
stable
set search_path = public
as $$
  select count(distinct coalesce(
    cm.user_id::text,
    cm.origin || ':' || cm.external_author_id
  ))::int
  from public.chat_messages cm
  where cm.stream_id = p_stream;
$$;

-- Signed-out visitors have no business calling this, and PostgREST exposes
-- anything callable to anon. Revoking PUBLIC as well as the two roles is the
-- part that actually closes it; revoking the roles alone leaves the inherited
-- grant in place.
revoke execute on function public.stream_unique_chatters(uuid) from public;
revoke execute on function public.stream_unique_chatters(uuid) from anon;
revoke execute on function public.stream_unique_chatters(uuid) from authenticated;
