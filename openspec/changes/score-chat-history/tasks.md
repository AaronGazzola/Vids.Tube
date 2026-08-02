# Tasks: score chat history

## 1. The shared scoring configuration

- [ ] 1.1 Create `lib/scoring-config.ts` exporting `SCORING_CONFIG` with `version`
  (string, starting `v1`), `criteria` (the three names with their one-line
  descriptions), `vidstubeMultiplier` (1.5, moved from the worker), and
  `rubric` (the wording the model reads, moved verbatim from the worker's
  `RUBRIC` constant minus its moderation paragraph).
- [ ] 1.2 Export `buildRubric({ includeModeration })` from the same module, so the
  live scorer gets the moderation paragraph appended and the backfill does not.
- [ ] 1.3 Change `worker/lib/scoring-prompt.ts` to build its prompt from
  `SCORING_CONFIG` and `buildRubric({ includeModeration: true })`, and to read
  `VIDSTUBE_MULTIPLIER` from the configuration. Behaviour is otherwise unchanged.
- [ ] 1.4 Add `tests/unit/scoring-config.test.ts` asserting: the live rubric
  contains the moderation paragraph and the backfill rubric does not; both name
  all three criteria; the version is a non-empty string.

## 2. Recording the version on ratings

- [ ] 2.1 New migration adding `score_events.scoring_version text`, nullable so
  existing rows stay valid, with an index on `(stream_id, scoring_version)` for
  the clear-before-rerun query.
- [ ] 2.2 Push the migration and regenerate `supabase/types.ts`.
- [ ] 2.3 In `worker/jobs/score.ts`, write `scoring_version: SCORING_CONFIG.version`
  on every `score_events` insert, in both the batch path and the manual-highlight
  path.

## 3. The backfill pass

- [ ] 3.1 Create `scripts/backfill-chat-scores.ts` taking `--stream <id>` for one
  broadcast, `--all` for the whole history, `--limit <n>`, and no `--apply`
  (dry-run by default, `--apply` to write).
- [ ] 3.2 For each broadcast: load its chat ordered by time, excluding messages
  whose `origin` is `bot` and messages whose `user_id` is the community's owner,
  and refuse the broadcast if it has no `transcript_segments`.
- [ ] 3.3 Batch the messages into groups of at most 25, and for each batch select
  the transcript segments spanning that batch's time range as the context, so a
  message is rated against what the streamer was saying at the time.
- [ ] 3.4 Build the prompt from `buildRubric({ includeModeration: false })`, call
  the model through the worker's existing `runClaude` helper, and parse with the
  existing `parseScoreResult`, ignoring the `featured` and `moderation` fields.
- [ ] 3.5 Convert each rating with the existing `pointsFor`, group by participant
  key exactly as the live path does, and write one `score_events` row per
  participant per batch carrying `scoring_version`.
- [ ] 3.6 After each broadcast, write one `viewer_scores` row per participant with
  that broadcast's summed points, replacing any existing row for the same
  participant and broadcast.
- [ ] 3.7 Before scoring a broadcast, delete its `score_events` rows carrying the
  current `scoring_version`, so a repeated or partial run cannot double-count.
- [ ] 3.8 After each broadcast, call `recompute_membership` for every participant
  scored, resolving a YouTube participant to their chatter channel and a site
  participant to their owned channel, and skipping the community channel itself.
- [ ] 3.9 Report per run: broadcasts scored, skipped, refused; messages rated;
  memberships whose standing changed; and total model calls.
- [ ] 3.10 Add the script to `package.json` as `backfill:scores`.

## 4. Trying it on one broadcast

- [ ] 4.1 Run the pass in dry-run for a single broadcast and confirm it reports the
  message count and batch count it would score, and writes nothing.
- [ ] 4.2 Run it with `--apply` for that one broadcast and record: messages rated,
  participants, the spread of per-participant points, and the top few messages by
  points.
- [ ] 4.3 Run `npm run verify:credit-ledger` afterwards and confirm the ledger is
  still consistent with the new experience totals.
- [ ] 4.4 Re-run the same broadcast with `--apply` and confirm every participant's
  experience for it is unchanged, proving the clear-before-write.
- [ ] 4.5 Record the outcome in the change's completion notes and stop, so the
  rubric can be judged before the full history is run.

## 5. Verification

- [ ] 5.1 Add `tests/unit/scoring-batches.test.ts` covering the pure batching and
  transcript-window selection: messages split into batches of at most 25; a batch's
  context is the transcript spanning its first and last message; an empty
  transcript yields no context rather than throwing.
- [ ] 5.2 Assert in the same test file that bot-origin messages and the host's
  messages are filtered out before batching.
- [ ] 5.3 Run `npx tsc --noEmit`, `npm run lint`, `npx vitest run` and confirm all
  pass.
- [ ] 5.4 Add a Linear issue for the full-history run, covering the expected cost,
  the batching, and the check that leaderboards look sane afterwards. Reference it
  in the completion notes and do not leave it as a task here.
