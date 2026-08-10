-- The swap function was revoked from anon and authenticated when it was added,
-- which reads as closed but is not. Postgres grants EXECUTE on a new function to
-- PUBLIC by default, and both roles inherit it from there, so revoking the roles
-- individually removes a grant they never held. The database agreed: the access
-- list still carried a bare `=X`, and the linter reported the function as
-- reachable over the public API by a signed-out visitor.
--
-- PUBLIC is the grant that has to go. The roles are named again alongside it so
-- the intent survives someone re-granting PUBLIC later.

revoke execute on function public.apply_recording_swap(
  uuid, uuid, double precision, text, integer, timestamptz
) from public, anon, authenticated;
