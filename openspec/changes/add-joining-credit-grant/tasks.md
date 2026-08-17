# Tasks

## 1. Schema

- [x] 1.1 `npx supabase migration new add_joining_credit_grant`: a partial unique index on
      `credit_entries (membership_id) where kind = 'joined'`, mirroring the existing
      `credit_entries_one_earned_per_membership`. This is what makes "once and never again" a database
      guarantee rather than a caller's good manners.
- [x] 1.2 Same migration: the amount as a constant inside the grant function, with a comment saying it is
      priced against `!tts` costing one credit, so a later reader changing one knows to look at the
      other. Named `v_amount` rather than `JOINING_CREDIT_GRANT`, matching the surrounding plpgsql.
- [x] 1.3 Same migration: `grant_joining_credits(p_membership_id uuid)`, security definer with a fixed
      search path, inserting the grant line and doing nothing on conflict, then calling the existing
      `sync_membership_credits` so the cached balance matches the ledger immediately.
- [x] 1.4 Same migration: the function returns without granting when the membership's channel is the
      community's own channel, or when the channel is marked software. Both checks live in the function
      rather than in the trigger, so any future caller inherits them. **Found while testing:** the host
      case is already impossible — `memberships_check` forbids a row whose channel is its own community —
      so that guard is belt-and-braces rather than the thing doing the work. Kept, because a future
      caller should not have to know that constraint exists.
- [x] 1.5 Same migration: an `after insert` trigger on `public.memberships` calling the function.
      `recompute_membership` inserts with `on conflict do nothing` and never deletes a membership, so an
      insert trigger fires exactly once per membership and a rebuild, which only updates, cannot fire it
      again. Confirm both facts by reading `recompute_membership` before writing the trigger.
- [x] 1.6 Same migration: revoke `execute` on the grant function from `anon` and `authenticated`. A
      routine that hands out credits must not be callable over the public API, which is the exact class
      of hole the `close_public_routine_access` migration was written to close.
- [x] 1.7 `npx supabase db push`, then regenerate `supabase/types.ts` and record the date here.

## 2. Do not backfill

- [x] 2.1 The migration SHALL NOT grant to the 147 memberships that already exist. Every one of them
      joined before the grant existed, and paying them retrospectively would move the balances the
      returning-chatter greeting has already been quoting. Write this decision as a comment in the
      migration so it is not read as an oversight.

## 3. Cover it

- [x] 3.1 Verified against the real database, but **not as a committed test file.** The grant is entirely
      SQL — a trigger, a function and a unique index — with no TypeScript seam, and the only honest test
      writes memberships to production. It was exercised as one transactional probe that raised at the
      end so the whole thing rolled back; confirmed afterwards that no probe channel, membership or
      ledger line survived. That is a one-off check, not standing cover.
- [x] 3.2 Probe results, all as required: a new membership held 5; a second grant call left it at 5 with
      one grant line; a recompute left it at 5; the ledger summed to the cached balance; a spend of 1
      succeeded and a spend of 99 was refused, leaving 4; a software channel was granted 0. **The host
      case was not exercised** — see 1.4, the database forbids the row entirely, so there was nothing to
      insert.
- [x] 3.3 Ran `npm run verify:credit-ledger` after deploy: 148 memberships, 148 ledger lines, every
      cached balance matching, `ok: true`. **No grant lines exist yet**, because no new chatter has
      joined since the trigger landed, so the half of this task that wanted the ledger proven *with*
      grants is not proven against production data.

## 4. The greeting still reads correctly

- [x] 4.1 Confirmed by reading `buildReturningGreeting`: a member whose only credits are their grant gets
      "You're on 5 credits." — sensible, and the above-zero guard now fires for every granted member
      instead of almost none. Builder left alone. Note the guard's original reasoning, that a zero
      balance reads as a rebuke, applies to fewer and fewer members from here.
- [ ] 4.2 The new-member greeting says nothing about credits. Whether it should announce the grant is an
      owner's decision about what the bot says on air, not something to settle from the code.
      **NOT DECIDED** — needs the owner, and belongs in Linear rather than here.

## 5. Land it

- [x] 5.1 `npx tsc --noEmit`, `npm run lint`, and
      `NODE_OPTIONS=--experimental-require-module doppler run -- npx vitest run`.
- [ ] 5.2 Run `openspec validate --strict` and archive.
