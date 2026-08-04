# Tasks: the automatic post-broadcast pass

## 1. The completion record

- [x] 1.1 New migration creating `broadcast_completions` keyed by `stream_id`
  (cascading on broadcast delete), carrying `started_at`, `finished_at`,
  `attempts`, `clean boolean`, and `steps jsonb` holding one entry per step with
  its result or error. Public read, service-role write, matching the pattern used
  by the membership tables.
- [x] 1.2 Push the migration and regenerate `supabase/types.ts`.

## 2. The pass itself

- [x] 2.1 Create `worker/lib/post-broadcast.ts` exporting
  `runPostBroadcastPass(streamId)` which claims the broadcast by writing its
  completion record first, so a second worker sees the row and skips.
- [x] 2.2 Order the steps: save the chat log, top up missed messages, score the
  chat, rebuild the memberships of everyone scored, check the ledger. Each step
  calls the existing script's exported entry point rather than reimplementing it.
- [x] 2.3 Record each step's result into `steps` as it completes, so a crash
  mid-pass still leaves evidence of how far it reached.
- [x] 2.4 Stop the pass when a step fails that later steps depend on — scoring
  before the rebuild — and record the reason. Continue past an independent
  failure, such as the chat log being unavailable.
- [x] 2.5 Skip a broadcast that already carries a clean record, and report it as
  already done.

## 3. Extracting the steps

- [x] 3.1 The pass invokes each script through its existing command line rather
  than importing an exported function. That keeps one code path — the automatic
  one runs exactly what a person runs — without reshaping five scripts. Scoping
  the membership rebuild to a single broadcast was needed, though: rebuilding all
  152 channels once per broadcast would have made a catch-up over the history
  quadratic. It now recomputes only the channels that took part, 4 rather than
  152 on the broadcast tested.

- [x] 3.2 Keep every existing command-line entry point working unchanged.

## 4. Wiring it to the worker

- [x] 4.1 In `worker/index.ts`, run the pass for a broadcast once engagement ends
  and the broadcast's status is `ended`.
- [x] 4.2 On worker start, find every ended broadcast with no completion record
  and run the pass over each, so a broadcast that ended while nothing was running
  is caught up.
- [x] 4.3 Log each pass and its outcome, so the worker's output shows what was
  completed rather than only what was engaged.

## 5. Verification

- [x] 5.1 Extract the step ordering and the failure rules into a pure function in
  `lib/post-broadcast-plan.ts`, so which steps run, in what order, and what a
  failure stops can be tested without a database.
- [x] 5.2 Add `tests/unit/post-broadcast-plan.test.ts` covering: the order
  respects the dependencies; a scoring failure stops the rebuild; an unavailable
  chat log does not stop scoring; a clean record means no steps run.
- [x] 5.3 Create `scripts/verify-post-broadcast.ts` asserting against production
  that every ended broadcast either carries a completion record or is listed as
  outstanding, and reporting how many are clean, failed and outstanding.
- [x] 5.4 Run `npx tsc --noEmit`, `npm run lint` and `npx vitest run`.
- [x] 5.5 Catch-up seeded rather than re-walked: 118 broadcasts already carry
  ratings from this cycle and were recorded as clean, leaving 50 outstanding —
  all of them broadcasts with no chat, which cost no model calls to complete.
