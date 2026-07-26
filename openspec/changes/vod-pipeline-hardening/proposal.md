# VOD pipeline hardening: stuck-row reaper, unambiguous matching, preview title inheritance

## Why

Two failure classes stranded VODs and sessions (Linear AZ-104, AZ-90;
`docs/roadmap.md` V0): (1) `processing` videos rows that never finalize are
never cleaned up, and the recording hook's "newest processing per channel"
fallback can attach a recording to the wrong broadcast when several stuck
rows exist; (2) ending a broadcast manually while the encoder keeps
streaming spawns a fresh `preview` row that loses the broadcast's
title/description and looks like a dead stream.

## What Changes

- New `reapStaleProcessingVods(channelId)` in `lib/broadcast-end.ts`: any
  `processing` video whose source stream has been `ended` for over an hour
  is resolved — published (`ready`) if an mp4 landed, otherwise flipped to
  `failed`. Runs from the ingest live heartbeat and from the owner's /live
  broadcast query, so it needs no cron.
- The recording hook's legacy fallback only matches when the channel has
  exactly one `processing` row; with several candidates and no `recordedAt`
  match it now 404s (the VM retries/preserves segments) instead of guessing.
- When the encoder keeps running after a manual end and the ingest live hook
  creates a fresh `preview` session, it inherits title/description/thumbnail
  from the just-ended broadcast (10-minute window) and logs a distinct tag,
  so re-going-live is one click with nothing retyped.

## Capabilities

### Modified Capabilities

- `vod-recording`: stuck `processing` rows self-heal (publish or fail);
  recording attachment never guesses among multiple candidates.
- `live-ingest`: post-end reconnects inherit the ended broadcast's details.

## Impact

- No schema changes. `failed` status already exists in the videos CHECK
  constraint. Full end-to-end verification (back-to-back streams) happens at
  the next stream via the AZ-157 smoke checklist.
