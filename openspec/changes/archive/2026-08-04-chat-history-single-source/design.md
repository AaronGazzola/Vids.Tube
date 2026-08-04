# Design: single-source chat history

## The rule

One table holds message history: `chat_messages`. Everything else is either
staging into it or derived from it.

```
YouTube VOD chat replay ──backfill──> youtube_chat_archive (staging)
                                            │
                                            └──import (idempotent per message)──┐
                                                                                ▼
live YouTube chat ────────worker──────────────────────────────────────────> chat_messages
vids.tube chat ───────────worker──────────────────────────────────────────>  (truth)
                                                                                │
                                        ┌───────────────────────────────────────┤
                                        ▼                                       ▼
                            recompute_membership                          gatherMeStats
                             (memberships, XP,                            (one query, no
                              streaks, per-stream)                          watermark)
```

`chatter_stats` sits beside the archive as a build artifact of the backfill run.
It is kept because the backfill reports against it, but nothing at runtime reads
it after this change.

## Why the watermark has to go rather than be extended

The current defence against double counting is
`chat_messages.created_at > chatter_stats.last_seen_at`. It works only while
imported rows are unattributed, because the account branch of `gatherMeStats`
has no equivalent filter. Adding a second watermark to the account branch would
make two branches agree by coincidence of timestamps; every future surface would
have to reproduce both. Collapsing to one query over one table means there is no
second count to reconcile.

This is the same principle already settled for aggregates in the roadmap: merge
raw events and recompute, never merge aggregates. `gatherMeStats` was the one
place still adding a pre-aggregated total to a raw count.

## Import idempotency

`importChat` currently guards with "does this stream already have any
YouTube-origin chat", which is why 4 streams are stuck partially imported. The
replacement is an upsert keyed on `external_message_id`, so re-running the
import converges regardless of how far a previous run got.

Two id shapes exist in `chat_messages.external_message_id`: the archive's
`message_id`, and the worker's `authorChannelId:publishedAt`. They do not
collide, and both are stable for the same message, so a single unique index over
`(stream_id, external_message_id)` serves both writers.

## The 13 unmapped videos

132 archive rows belong to videos with no stream row. Two possible causes: the
VOD import skipped them, or they are not stream VODs at all. The task list
resolves each explicitly rather than importing blindly, because inventing a
stream row for a non-stream video would corrupt attendance counts, and
attendance feeds streaks.

## Invariance across linking

The acceptance test for this whole change is one assertion: capture an
identity's message count, stream count and first-seen before a merge, run the
merge, and assert all three are unchanged. Linking rewrites keys on raw rows and
recomputes aggregates; it must never change how many messages exist.

## Out of scope

- Deleting `chatter_stats` or `youtube_chat_archive`. Both stay as staging and
  build artifacts.
- XP backfill over imported history. `viewer_scores` holds 19 rows, so
  leaderboards stay effectively empty until scoring is backfilled; that is
  separate work.
- Host attribution rules, owned by `host-participant-class`.
