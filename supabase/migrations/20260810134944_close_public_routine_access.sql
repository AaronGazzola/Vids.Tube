-- Nine SECURITY DEFINER routines were reachable by a signed-out visitor. The cause
-- is the same one the recording swap hit on 10-Aug-2026: Postgres grants EXECUTE on
-- every new function to PUBLIC, `anon` and `authenticated` inherit it from there, and
-- revoking those two roles by name removes a grant neither ever held. PUBLIC is the
-- grant that has to go. The roles are named again alongside it so the intent survives
-- someone re-granting PUBLIC later.
--
-- `is_participant_banned` is the exception, and it is the reason this is not a blind
-- sweep. The restrictive insert policy on `chat_messages` calls it, and a policy
-- expression is evaluated as the querying role, so revoking `authenticated` would deny
-- every signed-in chat message. The grant is therefore restored explicitly rather than
-- left inherited. The policy names `authenticated` only, so `anon` keeps nothing.
--
-- The three trigger routines are left with no grant at all. Firing a trigger does not
-- check EXECUTE on the trigger routine, so the grant bought exposure and nothing else.

revoke execute on function public.spend_credits(uuid, bigint, text, text)
  from public, anon, authenticated;

revoke execute on function public.write_earned_credits(uuid, bigint)
  from public, anon, authenticated;

revoke execute on function public.sync_membership_credits(uuid)
  from public, anon, authenticated;

revoke execute on function public.recompute_membership(uuid, uuid)
  from public, anon, authenticated;

revoke execute on function public.merge_youtube_identity(uuid)
  from public, anon, authenticated;

revoke execute on function public.membership_credits_sync()
  from public, anon, authenticated;

revoke execute on function public.reserve_handle_on_signup()
  from public, anon, authenticated;

revoke execute on function public.block_duplicate_community_identity()
  from public, anon, authenticated;

revoke execute on function public.is_participant_banned(uuid)
  from public, anon;

grant execute on function public.is_participant_banned(uuid)
  to authenticated;
