## Why

`!me` totals (messages, streams attended, first seen) come only from
`chatter_stats`, which is rebuilt by the manual YouTube backfill — so the
numbers freeze between reruns even though every live message (both origins)
already lands in `chat_messages`. The owner doesn't want to run the backfill
again; the live data should keep the stats current on its own.

## What Changes

- `gatherMeStats` merges live-captured history on top of the archive:
  - **YouTube side**: count `chat_messages` rows (`origin='youtube'`,
    matching `external_author_id`) created after the chatter's
    `chatter_stats.last_seen_at` watermark (all rows when no archive entry),
    adding to `total_messages`; distinct `stream_id`s among them add to
    `videos_attended`; `first_seen_at` falls back to the earliest live
    message when the archive has none.
  - **vids.tube side**: count the identity's own `chat_messages` (by
    `user_id`) into the message total (previously only YouTube messages
    counted).
- The backfill becomes an optional repair tool instead of required upkeep;
  Linear AZ-159 (auto-backfill) is closed as obsolete.

## Capabilities

- `me-command` (modified)
