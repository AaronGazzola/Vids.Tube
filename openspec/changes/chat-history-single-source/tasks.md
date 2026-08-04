# Tasks: chat_messages is the single source of chat history

Import idempotency, the archive-to-stored gap and the invisible chatters were
all closed by other work during this cycle, and their tasks are gone with them.
What is left is the double count and the summary table that causes it.

## 1. Counting from one place

- [x] 1.1 Rewrite `gatherMeStats` in `worker/lib/me-command.ts` to read only
  `chat_messages`, matching on `user_id` when the identity has one and on
  `external_author_id` when it has a YouTube account, counting both when the
  identity carries both. Delete the `chatter_stats` read and the
  `last_seen_at` watermark entirely.
- [x] 1.2 Derive `videosAttended` from the distinct `stream_id` values of those
  same rows, so attendance and message count cannot disagree.
- [x] 1.3 Rewrite `gatherRecentMessages` to read the same rows, so the sample the
  profile is written from matches the numbers beside it.
- [x] 1.4 Extract the row-to-stats reduction into a pure function in
  `lib/chatter-stats.ts` so it can be tested without the worker environment.

## 2. Proving linking does not change the numbers

- [x] 2.1 Add `tests/unit/chatter-stats.test.ts` asserting that the same set of
  rows produces identical totals whether they carry a user id, a YouTube
  account, or both — which is exactly what the identity merge changes.
- [x] 2.2 Assert in the same file that a row matching on both is counted once,
  not twice.
- [x] 2.3 Assert that attendance counts distinct broadcasts rather than rows.

## 3. Repointing the creation job

- [x] 3.1 Change `scripts/create-unclaimed-channels.ts` to read distinct authors
  from `chat_messages` rather than `chatter_stats`, keeping the host and claimed
  skip set added by `host-participant-class`.
- [x] 3.2 Run the job and assert it creates nothing, since every author already
  has a channel.

## 4. Removing the summary table

- [x] 4.1 Remove the aggregation step from `scripts/backfill-youtube-chat.ts`,
  leaving it writing only the archive.
- [x] 4.2 Update `scripts/verify-me-command.ts` to assert against `chat_messages`
  rather than `chatter_stats`.
- [x] 4.3 Confirm by search that no source file reads `chatter_stats`, then add a
  migration dropping the table.
- [x] 4.4 Push the migration and regenerate `supabase/types.ts`.

## 5. Verification

- [x] 5.1 Create `scripts/verify-chat-history.ts` asserting against production:
  every author in the archive has stored chat; no channel with stored chat lacks
  a membership except the host; and the archive is read by no runtime surface.
- [x] 5.2 The invariance check as first written was wrong, and the verifier
  caught it: a linked identity legitimately holds MORE messages than its YouTube
  account alone, because site-typed messages carry only a user id. The host reads
  209 by account and 212 in total. The assertion is now the one that matters —
  no message is counted twice — and it reports what the old two-branch count
  would have produced: 421 against the correct 212.
