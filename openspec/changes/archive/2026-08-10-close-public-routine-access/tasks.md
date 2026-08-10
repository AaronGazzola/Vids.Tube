# Tasks — close public access to privileged routines

**Evidence rule.** A box is checked only with a result that would have failed had the work
not been done. A revoke statement present in a migration is not evidence that the grant is
gone: that is precisely the mistake this change exists to correct. The evidence is the
access list read back from the database, and a chat message posted after the revoke.

## 1. The revoke

- [x] 1.1 Create the migration with `npx supabase migration new close_public_routine_access`,
      never by hand, following the existing migration naming.
- [x] 1.2 In it, `revoke execute … from public, anon, authenticated` on the two credit
      routines (`spend_credits`, `write_earned_credits`), the two credit sync routines
      (`sync_membership_credits`, `membership_credits_sync`), `recompute_membership` and
      `merge_youtube_identity`, matching each routine's full argument list so the right
      overload is named.
- [x] 1.3 In the same migration, revoke the same three roles on the three trigger routines
      (`reserve_handle_on_signup`, `membership_credits_sync`, `block_duplicate_community_identity`),
      leaving them with no grant, since firing a trigger does not check `EXECUTE`.
- [x] 1.4 In the same migration, revoke `public, anon` on `is_participant_banned` and then
      `grant execute … to authenticated`, so the restrictive insert policy on
      `chat_messages` keeps working through an explicit grant rather than an inherited one.
- [x] 1.5 Head the migration with a comment naming why `PUBLIC` is the grant that matters
      and why `is_participant_banned` is the exception, following the recording swap
      revoke's comment.
- [x] 1.6 Push with `npx supabase db push`.

## 2. Prove the revoke landed

- [x] 2.1 Add `scripts/verify-routine-access.ts` (service role, the env and client pattern of
      `scripts/verify-moderation.ts`), reading the access list of every `SECURITY DEFINER`
      routine in the public schema straight from the catalogue.
      Uses the Management API query endpoint rather than a Supabase client, because the
      catalogue is not exposed over the data API. That is the pattern
      `scripts/verify-credit-merge.ts` already uses, so it needs `-c dev_personal`.
- [x] 2.2 Have it fail, naming each offending routine, when such a routine carries the
      `PUBLIC` grant, with `is_participant_banned`'s grant to `authenticated` declared in the
      script as the single allowed exception.
      Proven by removing the exception and re-running: the check failed, naming
      `is_participant_banned`. The exception was then restored.
- [x] 2.3 Have it assert the nine routines' access lists hold only the owner, the service
      role, and that one exception.
      Covers all twelve `SECURITY DEFINER` routines rather than the nine, so a routine that
      was already closed cannot be re-opened unnoticed.
- [x] 2.4 Run it and record the result.
      Twelve routines checked, none reachable by a signed-out visitor.

## 3. Prove nothing broke

- [x] 3.1 Extend `scripts/verify-moderation.ts`, which already bans and unbans a participant,
      to insert a chat message as a signed-in member who is not banned and assert the insert
      succeeds, so the policy's call into the ban routine is exercised under the new grant.
      A throwaway user is created and signed in, since inserting as the service role
      bypasses row-level security and would exercise nothing. The stream is opened on the
      throwaway user's own channel, because a channel may hold only one active stream and
      the owner's channel already had one.
- [x] 3.2 In the same script, assert a banned member's insert is still denied by the policy,
      so the exception grant is shown to preserve the restriction rather than remove it.
- [x] 3.3 Assert the three triggers still fire with no grant: create a user, write a
      membership's earned credits, and attempt a duplicate community identity, expecting the
      duplicate to be rejected.
      The signup trigger is asserted in `scripts/verify-moderation.ts`, by the throwaway
      user's channel existing. The other two are already asserted by
      `scripts/verify-credit-merge.ts` and `scripts/verify-host-class.ts`, which were run
      rather than duplicated: nine of nine credit cases passed, and the duplicate community
      identity was rejected.
- [x] 3.4 Call one revoked routine with the anonymous key and assert the call is refused,
      so the closure is proven from outside rather than from the catalogue alone.
      Two are called, with their real arguments so a refusal cannot be mistaken for a
      mistyped signature. Both return permission denied.
- [x] 3.5 Re-read the Supabase advisors and confirm no routine is reported as reachable by a
      signed-out visitor.
      No such advisory remains. One warning remains by design, naming
      `is_participant_banned` as callable by signed-in users, which is the exception this
      change made deliberately.

## 4. Land it

- [x] 4.1 Run `openspec validate --strict` and archive.
