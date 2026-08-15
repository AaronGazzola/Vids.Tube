## 1. Each step says what it did

- [ ] 1.1 Add `lib/step-result.ts` exporting `formatStepResult(obj)` producing a final
      `::result {json}` line, and `parseStepResult(output)` returning the parsed object from the
      last such line in a script's output, or `null` when there is none.
- [ ] 1.2 Print a result line from each step script: `scripts/backfill-youtube-chat.ts`
      `{ archived }`, `scripts/topup-youtube-chat.ts` `{ missing, inserted }`,
      `scripts/backfill-chat-scores.ts` `{ scored, failed }`,
      `scripts/recompute-memberships.ts` `{ rebuilt }`, `scripts/verify-credit-ledger.ts`
      `{ ok }`. Keep the existing human-readable output above it unchanged.
- [ ] 1.3 Add a `--video <id>` flag to `scripts/backfill-youtube-chat.ts` restricting the run to
      one video, so its result line describes the broadcast it is stored against rather than a
      total across every video the script has ever seen.

## 2. Judge a step by its report

- [ ] 2.1 In `lib/post-broadcast-plan.ts`, widen `StepOutcome` to carry `result: unknown` and
      `status: "ok" | "failed" | "unknown"` in place of the boolean `ok`, keeping `error`.
- [ ] 2.2 Add `judgeStep(step, exitedCleanly, result)` returning that status, with the per-step
      rules: `saveChatLog` ok at any `archived` including zero, since zero means no replay yet;
      `topUpChat` failed when `inserted < missing`; `scoreChat` failed when `failed > 0`;
      `rebuildMemberships` ok on any `rebuilt`; `checkLedger` judged on `ok` alone. A missing
      result line is `unknown` for every step, and a non-zero exit is `failed` regardless.
- [ ] 2.3 Change `isClean(outcomes)` to require every outcome be `ok`, so `unknown` prevents a
      clean record. Update `blockedBy` to treat anything other than `ok` as a blocker.
- [ ] 2.4 In `worker/lib/post-broadcast.ts`, parse the result line from each step's output and
      record `judgeStep`'s verdict, storing the parsed result on the record in place of the
      current last-line-of-output detail.

## 3. Two phases

- [ ] 3.1 In `lib/post-broadcast-plan.ts`, add `export type Phase = "score" | "settle"` and
      `stepsForPhase(phase)`: score runs `topUpChat`, `scoreChat`, `rebuildMemberships`,
      `checkLedger`; settle runs all five beginning with `saveChatLog`. Score deliberately omits
      `saveChatLog`, since a replay ten minutes old cannot be fetched and trying is what produced
      records claiming no gaps against an empty archive.
- [ ] 3.2 Add `phaseOwed(record, endedAt, nowMs)` returning `"score"` when no record is clean,
      `"settle"` when clean but not settled and at least 20 hours have passed since the broadcast
      ended, and `null` otherwise.
- [ ] 3.3 Add `settleOutcome(archived, endedAt, nowMs)` returning `"merged"` when the fetch found
      messages, `"expired"` when it found none and 7 days have passed, and `"retry"` when it found
      none and less than 7 days have passed.
- [ ] 3.4 Change `runPostBroadcastPass(streamId)` to `runPostBroadcastPass(streamId, phase)`,
      running only that phase's steps, and to write `settled`, `settled_at` and `settle_note`
      when the settle phase reaches `merged` or `expired`.

## 4. The record carries settled

- [ ] 4.1 Create a migration adding `settled boolean not null default false`, `settled_at
      timestamptz` and `settle_note text` to `broadcast_completions`, with an index on `settled`,
      and a comment stating that `clean` means every step of a phase succeeded while `settled`
      means the chat replay has been accounted for.
- [ ] 4.2 Backfill `settled = true` with `settle_note = 'repaired before phases existed'` for
      every broadcast that already carries a clean record, so the first sweep does not re-fetch
      171 replays. Their chat was already topped up by the old pass or by `npm run repair`.
- [ ] 4.3 Check `supabase/migrations` against the remote with `supabase migration list --linked`
      before pushing, since `db push` applies every pending migration. Then push and regenerate
      `supabase/types.ts`.
- [ ] 4.4 Replace `outstandingBroadcasts` in `worker/lib/post-broadcast.ts` with a query selecting
      ended broadcasts that are not settled, joined to their completion record, returning each
      with the phase it owes from `phaseOwed`.

## 5. The runner

- [ ] 5.1 Add `worker/maintain.ts`: run the preflight, take the broadcasts owing work, settle at
      most 3, print one line per broadcast and a closing count of how many remain, then exit.
      Exit non-zero only when the preflight fails, so a broadcast that fails a step does not make
      the scheduler treat the whole sweep as broken.
- [ ] 5.2 Add the preflight to `worker/maintain.ts` in the shape of `worker/doctor.ts`: check
      `yt-dlp` and `claude` are on the path and that `SUPABASE_SECRET_KEY` and
      `NEXT_PUBLIC_SUPABASE_URL` are set, and exit naming what is missing without writing any
      completion record.
- [ ] 5.3 Add `"maintain": "doppler run -- tsx worker/maintain.ts"` to `package.json`.
- [ ] 5.4 Remove the post-broadcast block from the `finally` in `worker/index.ts`, leaving the
      lock release, and update the comment in `main()` that currently points at `npm run repair`.
- [ ] 5.5 Update `scripts/repair-broadcasts.ts` to take `--phase score|settle`, defaulting to
      whichever phase the broadcast owes, so the manual override still works while the runner is
      being installed.

## 6. Install it on the always-on machine

- [ ] 6.1 Add `scripts/macos/dev.vidstube.maintain.plist` running `npm run maintain` every 1800
      seconds with `RunAtLoad`, writing stdout and stderr to files under `~/Library/Logs/`.
- [ ] 6.2 Add `docs/runbooks/maintenance-runner.md` covering what the machine needs (node,
      Doppler authenticated against the `prd` config, `yt-dlp`, the Claude CLI signed in), how to
      load and unload the plist, where the logs go, and how to run one sweep by hand.
- [ ] 6.3 Record in that runbook that the live worker no longer settles broadcasts, so until the
      plist is loaded nothing settles them and `npm run maintain` must be run by hand.

## 7. Prove it

- [ ] 7.1 Extend `tests/unit/post-broadcast-plan.test.ts` for `phaseOwed` across: no record;
      clean but 2 hours old; clean at 21 hours; clean and settled. And for `settleOutcome` across
      merged, retry at 2 days, expired at 8 days.
- [ ] 7.2 Add `tests/unit/step-result.test.ts` for `parseStepResult` over output with one result
      line, several, none, and a malformed one; and for `judgeStep` over each step's rules,
      including `saveChatLog` with zero archived being ok and `topUpChat` with a partial insert
      being failed.
- [ ] 7.3 Run `NODE_OPTIONS=--experimental-require-module doppler run -- npx vitest run`,
      typecheck, lint and a production build.
- [ ] 7.4 Run `npm run maintain` once against production and confirm it reports nothing owing,
      every broadcast having been settled by the backfill in 4.2.

## 8. Land it

- [ ] 8.1 Run `openspec validate --strict` and archive the change.
- [ ] 8.2 Add to `docs/runbooks/next-broadcast-checklist.md` that the first broadcast after this
      change is the first to be settled by the runner, and what to check: that it was scored
      within an hour of ending, and that its replay was merged the following day.
