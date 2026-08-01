# Tasks: single-source chat history

## 1. Import idempotency

- [ ] 1.1 Create the migration via
  `npx supabase migration new chat_messages_external_id_unique` adding a unique
  index on `chat_messages (stream_id, external_message_id)` where
  `external_message_id is not null`; push with `npx supabase db push` and
  regenerate `supabase/types.ts`.
- [ ] 1.2 In `scripts/import-youtube-vods.ts` `importChat`, delete the
  "stream already has YouTube chat, return 0" guard and replace the plain insert
  with an upsert on `(stream_id, external_message_id)` that ignores conflicts.
- [ ] 1.3 Make `importChat` return `{ inserted, skipped, archiveTotal }` and log
  the triple per video so a partial import is visible in the run output.

## 2. Close the import gap

- [ ] 2.1 Add a `--report` mode to `scripts/import-youtube-vods.ts` that, without
  writing, lists every `youtube_chat_archive.video_id` with no matching
  `streams.youtube_video_id` (currently 13 videos, 132 rows) and every video whose
  imported count differs from its archive count (currently 4 streams).
- [ ] 2.2 Resolve each of the 13 unmapped videos explicitly: create the stream row
  where the video is a stream VOD, or add it to an explicit skip list in the
  script with a one-line reason. Do not import a non-stream video.
- [ ] 2.3 Re-run the import and assert per video that the imported count equals the
  archive count for every video not on the skip list.

## 3. Single-source `!me`

- [ ] 3.1 Rewrite `gatherMeStats` in `worker/lib/me-command.ts` to one query over
  `chat_messages` filtered by `user_id` or by `origin = 'youtube'` with the
  identity's `external_author_id`, returning message total, distinct stream count
  and earliest `created_at`.
- [ ] 3.2 Delete the `chatter_stats` read and the `last_seen_at` watermark from
  `gatherMeStats`, and delete the separate `user_id` count branch that produced
  the double count.
- [ ] 3.3 Repoint the sample gathering in the same file so it reads only
  `chat_messages`, dropping the `youtube_chat_archive` query.
- [ ] 3.4 Keep `viewer_scores` reads for XP and features unchanged; only the
  message and attendance counts move.
- [ ] 3.5 Add a unit test in `tests/unit/me-command.test.ts` asserting that an
  identity with both imported and live messages reports each message once.

## 4. Membership coverage

- [ ] 4.1 Create the migration via
  `npx supabase migration new recompute_membership_archive_coverage` updating
  `recompute_membership` so the history gate matches any `chat_messages` row for
  the identity in the community's streams, regardless of origin or how it was
  written.
- [ ] 4.2 Run a recompute pass over every unclaimed channel and assert the count of
  memberships in the owner community rises from 138 to cover all identities with
  history, and that the 11 currently-empty profiles report non-zero totals.
- [ ] 4.3 Assert no membership is created for an identity with no messages.

## 5. Repoint the creation job

- [ ] 5.1 In `scripts/create-unclaimed-channels.ts`, replace the `chatter_stats`
  read with a distinct `external_author_id` query over `chat_messages` where
  `origin = 'youtube'`, keeping the skip set added by `host-participant-class`.
- [ ] 5.2 Keep display-name resolution working when `chat_messages.author_name` is
  the only name source, falling back to the YouTube snippet fetch as today.
- [ ] 5.3 Re-run the job and assert it is a no-op against the repaired data.

## 6. Verification

- [ ] 6.1 Create `scripts/verify-chat-history.ts` asserting: per video, archive row
  count equals imported row count for every non-skipped video; no identity's
  `!me` totals differ from a direct `chat_messages` count; no membership exists
  for an identity with zero messages.
- [ ] 6.2 Extend it with the linking-invariance check: capture an identity's
  message total, stream count and first-seen, run `merge_youtube_identity` for a
  test user, and assert all three are unchanged.
- [ ] 6.3 Run `npx tsc --noEmit`, `npm run build:local`, and the unit tests.
