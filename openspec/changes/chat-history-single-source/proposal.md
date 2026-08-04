# `chat_messages` is the single source of chat history

## Why

Message history lives in two tables with two counting paths, reconciled by a timestamp watermark that only protects one of them.

`gatherMeStats` adds a summary table (`chatter_stats`, built from the YouTube archive) to chat rows newer than that summary's watermark, and separately adds every chat row matching the viewer's user id with no date filter at all. Before a chatter links their YouTube account the two branches do not overlap, because imported rows carry no user id. After the identity merge re-keys those rows to the user, the account branch counts messages the archive branch already counted. Claiming an identity inflates its own totals, which is the opposite of what claiming promises.

This proposal was first written when the two tables also disagreed about the data itself: 4986 archive rows against 4779 stored messages, 13 archive videos mapping to no broadcast, and 11 chatters with a profile of zeros. None of that is still true. The import became idempotent per message, the top-up closed the gaps, and the membership rebuild reached every chatter. Measured 3-Aug-2026:

- 5169 stored messages against 5112 archive rows, so stored chat now exceeds the archive rather than trailing it.
- 0 archive videos map to no broadcast.
- 0 authors appear in one table and not the other.
- 1 channel has chat but no membership, and that channel is the host, which holds no membership by design.

So the data reconciliation is done. What remains is the double count itself, which is currently unreachable in production for one reason only: the sole account that is both linked and present in the summary table is the streamer's, and the streamer now takes the host branch before `gatherMeStats` is reached. The moment any real chatter verifies their YouTube link — a shipped feature — the fault becomes live.

## What Changes

- `gatherMeStats` collapses to one query over stored chat, filtered by user id or YouTube account, deleting both the summary-table read and the watermark. The double count goes structurally rather than by adding another filter.
- The unclaimed-channel job reads stored chat rather than the summary table.
- The summary table loses its last reader and is dropped, along with the aggregation step that maintains it.
- The YouTube archive is confirmed as import staging only, with no runtime surface reading it.
- The streamer is excluded from the archive aggregation, since a host is not a chatter. Today the summary table still credits them with 203 messages.
- Totals become invariant across linking: a chatter's message and broadcast counts are identical immediately before and after they claim, asserted rather than assumed.

## Capabilities

### Modified Capabilities

- `chat-history-index`: the archive is staging, the summary table is removed, and stored chat is the only source of counts.
- `me-command`: chatter statistics come from one source with no watermark, and are unchanged by linking.

## Impact

- Worker: `gatherMeStats` and its sample gathering in `worker/lib/me-command.ts`.
- Scripts: `scripts/create-unclaimed-channels.ts` repointed; `scripts/backfill-youtube-chat.ts` loses its aggregation step; `scripts/verify-me-command.ts` updated.
- Migration: drops the summary table once nothing reads it.
- No UI work and no data migration: the numbers are already correct in stored chat.
