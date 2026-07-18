## 1. Worker

- [x] 1.1 `worker/lib/me-command.ts` `gatherMeStats`: for a YouTube identity,
  select `stream_id, created_at` from `chat_messages` where
  `origin='youtube'` and `external_author_id` matches, filtered to
  `created_at > chatter_stats.last_seen_at` when an archive row exists
  (unfiltered otherwise, limit 2000); add the row count to `totalMessages`,
  the distinct `stream_id` count to `videosAttended`, and use the earliest
  `created_at` as `firstSeenAt` when the archive has none. For a vids.tube
  `userId`, add the count of their `chat_messages` rows to `totalMessages`
  and min their earliest `created_at` into `firstSeenAt`.

## 2. Verify

- [x] 2.1 `npx tsc --noEmit`, `npm run lint`, `npx vitest run` clean.
- [x] 2.2 Real-data check: a temp script (or extended
  `scripts/verify-me-command.ts` run) shows a chatter's stats now exceed
  their frozen `chatter_stats` totals when live-captured `chat_messages`
  exist past the watermark, and equal them when none do; rerun
  `verify-me-command.ts` end-to-end green.
- [x] 2.3 Close Linear AZ-159 as obsolete with a comment.
- [x] 2.4 `npx openspec validate update-me-live-stats --strict`.
