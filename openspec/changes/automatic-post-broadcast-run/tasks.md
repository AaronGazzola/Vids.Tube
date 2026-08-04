# Tasks: the automatic post-broadcast pass

## 1. The completion record

- [ ] 1.1 New migration creating `broadcast_completions` keyed by `stream_id`
  (cascading on broadcast delete), carrying `started_at`, `finished_at`,
  `attempts`, `clean boolean`, and `steps jsonb` holding one entry per step with
  its result or error. Public read, service-role write, matching the pattern used
  by the membership tables.
- [ ] 1.2 Push the migration and regenerate `supabase/types.ts`.

## 2. The pass itself

- [ ] 2.1 Create `worker/lib/post-broadcast.ts` exporting
  `runPostBroadcastPass(streamId)` which claims the broadcast by writing its
  completion record first, so a second worker sees the row and skips.
- [ ] 2.2 Order the steps: save the chat log, top up missed messages, score the
  chat, rebuild the memberships of everyone scored, check the ledger. Each step
  calls the existing script's exported entry point rather than reimplementing it.
- [ ] 2.3 Record each step's result into `steps` as it completes, so a crash
  mid-pass still leaves evidence of how far it reached.
- [ ] 2.4 Stop the pass when a step fails that later steps depend on — scoring
  before the rebuild — and record the reason. Continue past an independent
  failure, such as the chat log being unavailable.
- [ ] 2.5 Skip a broadcast that already carries a clean record, and report it as
  already done.

## 3. Extracting the steps

- [ ] 3.1 Give each of the five scripts an exported function taking a single
  broadcast, so the pass calls the same code a person runs by hand: the chat
  backfill, the top-up, the scoring backfill, the membership recompute, and the
  ledger verifier.
- [ ] 3.2 Keep every existing command-line entry point working unchanged.

## 4. Wiring it to the worker

- [ ] 4.1 In `worker/index.ts`, run the pass for a broadcast once engagement ends
  and the broadcast's status is `ended`.
- [ ] 4.2 On worker start, find every ended broadcast with no completion record
  and run the pass over each, so a broadcast that ended while nothing was running
  is caught up.
- [ ] 4.3 Log each pass and its outcome, so the worker's output shows what was
  completed rather than only what was engaged.

## 5. Verification

- [ ] 5.1 Extract the step ordering and the failure rules into a pure function in
  `lib/post-broadcast-plan.ts`, so which steps run, in what order, and what a
  failure stops can be tested without a database.
- [ ] 5.2 Add `tests/unit/post-broadcast-plan.test.ts` covering: the order
  respects the dependencies; a scoring failure stops the rebuild; an unavailable
  chat log does not stop scoring; a clean record means no steps run.
- [ ] 5.3 Create `scripts/verify-post-broadcast.ts` asserting against production
  that every ended broadcast either carries a completion record or is listed as
  outstanding, and reporting how many are clean, failed and outstanding.
- [ ] 5.4 Run `npx tsc --noEmit`, `npm run lint` and `npx vitest run`.
- [ ] 5.5 Run the catch-up over the existing history and record the outcome,
  since all 168 broadcasts currently carry no record.
