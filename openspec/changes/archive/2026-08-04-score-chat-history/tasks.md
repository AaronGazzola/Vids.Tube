# Tasks: score chat history

## 1. The shared scoring configuration

- [x] 1.1 Create `lib/scoring-config.ts` exporting `SCORING_CONFIG` with `version`
  (string, starting `v1`), `criteria` (the three names with their one-line
  descriptions), `vidstubeMultiplier` (1.5, moved from the worker), and
  `rubric` (the wording the model reads, moved verbatim from the worker's
  `RUBRIC` constant minus its moderation paragraph).
- [x] 1.2 Export `buildRubric({ includeModeration })` from the same module, so the
  live scorer gets the moderation paragraph appended and the backfill does not.
- [x] 1.3 Change `worker/lib/scoring-prompt.ts` to build its prompt from
  `SCORING_CONFIG` and `buildRubric({ includeModeration: true })`, and to read
  `VIDSTUBE_MULTIPLIER` from the configuration. Behaviour is otherwise unchanged.
- [x] 1.4 Add `tests/unit/scoring-config.test.ts` asserting: the live rubric
  contains the moderation paragraph and the backfill rubric does not; both name
  all three criteria; the version is a non-empty string.

## 2. Recording the version on ratings

- [x] 2.1 New migration adding `score_events.scoring_version text`, nullable so
  existing rows stay valid, with an index on `(stream_id, scoring_version)` for
  the clear-before-rerun query.
- [x] 2.2 Push the migration and regenerate `supabase/types.ts`.
- [x] 2.3 In `worker/jobs/score.ts`, write `scoring_version: SCORING_CONFIG.version`
  on every `score_events` insert, in both the batch path and the manual-highlight
  path.

## 3. The backfill pass

- [x] 3.1 Create `scripts/backfill-chat-scores.ts` taking `--stream <id>` for one
  broadcast, `--all` for the whole history, `--limit <n>`, and no `--apply`
  (dry-run by default, `--apply` to write).
- [x] 3.2 For each broadcast: load its chat ordered by time, excluding messages
  whose `origin` is `bot` and messages whose `user_id` is the community's owner,
  and refuse the broadcast if it has no `transcript_segments`.
- [x] 3.3 Batch the messages into groups of at most 25, and for each batch select
  the transcript segments spanning that batch's time range as the context, so a
  message is rated against what the streamer was saying at the time.
- [x] 3.4 Build the prompt from `buildRubric({ includeModeration: false })`, call
  the model through the worker's existing `runClaude` helper, and parse with the
  existing `parseScoreResult`, ignoring the `featured` and `moderation` fields.
- [x] 3.5 Convert each rating with the existing `pointsFor`, group by participant
  key exactly as the live path does, and write one `score_events` row per
  participant per batch carrying `scoring_version`.
- [x] 3.6 After each broadcast, write one `viewer_scores` row per participant with
  that broadcast's summed points, replacing any existing row for the same
  participant and broadcast.
- [x] 3.7 Before scoring a broadcast, delete its `score_events` rows carrying the
  current `scoring_version`, so a repeated or partial run cannot double-count.
- [x] 3.8 After each broadcast, call `recompute_membership` for every participant
  scored, resolving a YouTube participant to their chatter channel and a site
  participant to their owned channel, and skipping the community channel itself.
- [x] 3.9 Report per run: broadcasts scored, skipped, refused; messages rated;
  memberships whose standing changed; and total model calls.
- [x] 3.10 Add the script to `package.json` as `backfill:scores`.

## 4. Trying it on one broadcast

- [x] 4.1 Run the pass in dry-run for a single broadcast and confirm it reports the
  message count and batch count it would score, and writes nothing.
- [x] 4.2 Run it with `--apply` for that one broadcast and record: messages rated,
  participants, the spread of per-participant points, and the top few messages by
  points.
- [x] 4.3 Run `npm run verify:credit-ledger` afterwards and confirm the ledger is
  still consistent with the new experience totals.
- [x] 4.4 Re-run the same broadcast with `--apply` and confirm every participant's
  experience for it is unchanged, proving the clear-before-write.
- [x] 4.5 Outcome recorded: the first rubric was a message counter (105-121 points
  per message for three of four regulars). Rewritten to humour/insight/community
  with an anchored scale; points became the best dimension through a curve with
  nothing paid below 60. Top chatter on the trial broadcast fell from 18589 to
  416 points, 11% of messages earning anything. Ceiling raised to 300 and the
  level divisor lowered from 100 to 25, both approved. Projected over the full
  history: busiest chatter level 9, a regular level 4, most chatters level 0-1.

## 5. Verification

- [x] 5.1 Add `tests/unit/scoring-batches.test.ts` covering the pure batching and
  transcript-window selection: messages split into batches of at most 25; a batch's
  context is the transcript spanning its first and last message; an empty
  transcript yields no context rather than throwing.
- [x] 5.2 Assert in the same test file that bot-origin messages and the host's
  messages are filtered out before batching.
- [x] 5.3 Run `npx tsc --noEmit`, `npm run lint`, `npx vitest run` and confirm all
  pass.
- [x] 5.4 Superseded: the full-history run was going to be a Linear issue because
  it was gated on the owner judging the rubric. That judgement has been made and
  the calibration approved, so the run is section 6 below rather than a ticket.

## 6. The full-history run

- [x] 6.1 Delete the ratings from the two superseded generations before the run:
  207 unversioned ratings written by the live scorer under the old rubric, and 35
  `v1` ratings from the first trial. Neither can be re-derived, because the old
  dimensions do not mean what the new ones mean. Report the counts removed.
- [x] 6.2 Run `backfill:scores --all` across all 168 broadcasts. 138 hold chat;
  the other 30 are recorded as having none and will be skipped.
- [x] 6.3 Run it in batches rather than one pass, so a failure costs one batch
  and not the whole history, and report progress per broadcast.
- [x] 6.4 After the run, recompute every membership and run
  `npm run verify:credit-ledger`, confirming one earning line per membership and
  every cached balance matching.
- [x] 6.5 Leaderboard across the full history, top ten by experience:

  | rank | chatter | xp | level | credits | messages | broadcasts |
  | --- | --- | --- | --- | --- | --- | --- |
  | 1 | lehmolabs | 3038 | 11 | 303 | 855 | 13 |
  | 2 | henrycook859 | 1795 | 8 | 179 | 354 | 18 |
  | 3 | kuroma | 1637 | 8 | 163 | 1078 | 28 |
  | 4 | gtasanandreaser | 491 | 4 | 49 | 97 | 4 |
  | 5 | carlandj | 484 | 4 | 48 | 93 | 10 |
  | 6 | flipwithkyle | 479 | 4 | 47 | 93 | 3 |
  | 7 | productivedude | 473 | 4 | 47 | 152 | 12 |
  | 8 | ravgupta20 | 468 | 4 | 46 | 209 | 10 |
  | 9 | maran_ath4 | 391 | 3 | 39 | 36 | 2 |
  | 10 | clippana_by_yorker | 335 | 3 | 33 | 205 | 32 |

  The calibration holds against the whole history rather than one broadcast.
  Kuroma wrote the most messages of anyone and sits third; henrycook wrote a
  third of Kuroma's and outranks them; maran_ath4 reached ninth on 36 messages
  across 2 broadcasts. Volume no longer decides the order.

  Level spread: 113 at 0, 13 at 1, 9 at 2, 5 at 3, 5 at 4, 2 at 8, 1 at 11.
  673 ratings over 2854 rated messages, 13121 points awarded, highest single
  rating 249 of a possible 300.
