# Tasks

## 1. Schema

- [x] 1.1 `npx supabase migration new add_command_credit_cost`: `credit_cost integer not null default 0
      check (credit_cost >= 0)` on `public.chat_commands`. The check is what stops a command paying a
      chatter.
- [x] 1.2 Same migration: recreate the `command_events.status` check to admit `insufficient` alongside
      `executed`, `cooldown`, `limit`, `disabled` and `unknown`.
- [x] 1.3 Same migration: set `credit_cost = 1` on every existing `!tts` row, matching how the `!tts`
      command was seeded across all channels in `20260718025318_add_tts_requests.sql`.
- [x] 1.4 Same migration: a partial unique index on `credit_entries (source_id)` where `kind = 'command'`,
      so the same chat message cannot be charged twice even if the batch is reprocessed.
- [x] 1.5 `npx supabase db push`, then regenerate `supabase/types.ts` and record the date here.

## 2. Resolving who to charge

- [x] 2.1 `worker/lib/credits.ts`: `resolveMembershipId(message, communityId)`. **Recorded:** neither of
      the two named functions resolves the membership. `resolveMeIdentity` stops at the identity and
      `gatherMeStats` never touches memberships; the lookup actually lived inside the private
      `creditsLine`. That channel resolution — which follows a merge to the surviving channel — is now
      exported from `me-command.ts` as `resolveChannelId` and used by both, so the two cannot disagree
      about who someone is and charge the wrong purse.
- [x] 2.2 The host resolves to no charge at all, not to a missing membership. `BufferedMessage.isHost` is
      already stamped by the scoring job, so the host is identified before any lookup is attempted.
- [x] 2.3 `chargeCommand({ membershipId, amount, sourceId })` calling the existing `spend_credits`
      routine with a kind of `command` and the chat message id as the source, returning whether it was
      charged and the balance to quote when it was not. Do not write a second spend path: the routine
      already refuses an uncovered spend and already keeps the cached balance in step.
- [x] 2.4 `tests/unit/command-credits.test.ts`, partly. Covered pure: the host is never charged; a free
      command triggers no lookup; the refusal names the price and the balance and fits YouTube's limit.
      **Covered against the real database instead of in this file:** a spend against a balance succeeds,
      a spend beyond it is refused, and the cached balance follows — proven by a transactional probe that
      rolled back, recorded under 4.3. **Not covered:** `resolveMembershipId` and `chargeCommand`
      themselves, which are database round trips with no seam to test them behind.

## 3. Charging in the command layer

- [x] 3.1 In `processCommands` in `worker/lib/commands.ts`, insert the charge after the per-stream limit
      check and before the event is logged as executed. That position is what makes the requirement
      "never charged for a command that was going to be refused anyway" true by construction.
- [x] 3.2 A cost of zero SHALL take no lookup and no ledger call at all, so the free path costs exactly
      what it costs today.
- [x] 3.3 On an insufficient balance, log the event with status `insufficient`, deliver a reply naming
      the price and the chatter's balance, and continue to the next message without executing.
- [x] 3.4 The reply must fit YouTube's 200 characters. Build it with the same fitting helper the greeting
      builders use rather than assuming it is short enough.
- [x] 3.5 An overlay command is charged on the same terms as a builtin. It is an ordinary registry row,
      and an overlay whose commands were free while every other priced command was not would be a hole in
      the economy.

## 4. Cover it

- [ ] 4.1 `tests/unit/command-charge-order.test.ts`: a cooldown refusal deducts nothing; a per-stream
      limit refusal deducts nothing; a disabled command deducts nothing; an unknown command deducts
      nothing; a successful priced command deducts once and executes.
      **NOT DONE.** Every one of these outcomes is decided inside `processCommands`, which reaches the
      database at each step and has no seam to test behind. The ordering is instead guaranteed by
      position: the charge sits after the enabled, cooldown and limit checks and before the executed
      event is written. That is a code-reading argument, not a test.
- [x] 4.2 A zero-cost command performs no membership lookup, so the free path cannot quietly acquire a
      database round trip per message. Made assertable by extracting the decision into the pure
      `shouldCharge`, which the charging block is gated on, and covered in
      `tests/unit/command-credits.test.ts`.
- [x] 4.3 Ran `npm run verify:credit-ledger` against production after deploy: 148 memberships, 148 ledger
      lines, every cached balance matching, `ok: true`. **No spend lines exist yet** — no broadcast has
      run since the price landed — so the half of this task that wanted the ledger proven *with* spends
      is not proven. A transactional probe did exercise a spend end to end and roll it back, which is
      evidence the routine works but not evidence about production data.

## 5. Correct the roadmap

- [x] 5.1 In `docs/roadmap.md`, the V3 section states `credit_cost` on the command registry and `!tts` as
      the first sink shipped early. Rewrite that sentence to say what actually shipped then, and that the
      sink landed with this change. Leave the rest of the section alone.

## 6. Land it

- [x] 6.1 `npx tsc --noEmit`, `npm run lint`, and
      `NODE_OPTIONS=--experimental-require-module doppler run -- npx vitest run`.
- [ ] 6.2 Run `openspec validate --strict` and archive.
