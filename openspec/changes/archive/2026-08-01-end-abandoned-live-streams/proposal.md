# End abandoned live broadcasts so their VOD can never strand

## Why

The 2026-07-28 broadcast (`fa1437e7`) is still `status='live'` with
`last_seen_at` of 2026-07-28T15:15:09Z — the encoder disconnected and the owner
never pressed End. Its recording finalized correctly (mp4, thumbnail, previews,
`duration_s=7930` all landed on `videos` row `0a14c71a`), but the VOD has been
stuck `processing` for four days because every publish path requires the source
stream to be `ended`:

- `/api/ingest/recording` only sets `status='ready'` when the source stream is
  `ended`.
- `reapStaleProcessingVods` explicitly `continue`s when the source stream is not
  `ended`, so the existing stuck-row reaper can never reach this case.
- `/api/ingest/offline` deliberately never ends a `live` row (reconnect support),
  and `endStreamAction` is the only transition out of `live`.

So "owner forgets to press End" is an unrecoverable state: the VOD is invisible
forever, the channel keeps advertising a disconnected live broadcast, the
reconnect gap stays open, and the next encoder connect resumes the stale row
instead of starting a fresh broadcast. On the VM the raw segments are also never
deleted (`mtx-finalize-vod.sh` only removes them when the app reports
`ended: true`), so the next broadcast's finalize would concatenate the abandoned
session's footage into the new VOD.

## What Changes

- New `public.end_abandoned_live_streams()` SQL function (security definer) that
  ends any `live` stream whose feed has been silent for over 2 hours: closes the
  open reconnect gap, sets `status='ended'` with `ended_at` = last confirmed feed
  time (not `now()`, so stream duration and chat-replay math stay truthful), and
  publishes its `processing` VOD when an `mp4_path` has landed.
- A broadcast on an owner-declared break is exempt until 2 hours past
  `break_ends_at`, so a planned 12-hour break is never auto-ended.
- A pg_cron job runs it every 15 minutes, matching the existing
  `delete-unconfirmed-users` pattern. This is deliberately DB-side rather than
  request-triggered: the abandonment case is precisely the case where no encoder
  heartbeat is arriving, so an in-app reaper cannot be relied on to fire.
- The existing `reapStaleProcessingVods` is unchanged: once the stream is
  `ended`, it becomes reachable again and still owns the "no mp4 ever arrived →
  `failed`" policy. One rule, one writer.

## Capabilities

### Modified Capabilities

- `stream-lifecycle`: `live → ended` gains a second, automatic trigger for
  abandoned broadcasts, alongside the owner's explicit End.
- `vod-recording`: a VOD whose broadcast is abandoned rather than ended now
  publishes instead of stranding in `processing`.

## Impact

- One migration: the function plus the cron schedule. No table or column changes.
- Heals `fa1437e7` / VOD `0a14c71a` on first run.
- Does not change `endStreamAction`, `/api/ingest/offline`, or the reconnect
  behaviour; a disconnect still never ends a broadcast inside the reconnect
  window.
- Out of scope, filed separately: `mtx-finalize-vod.sh` is not trimming pre-live
  footage (both the 2026-07-26 and 2026-07-28 VODs run from encoder connect, not
  `live_at`), which desynchronises `live_at`-anchored chat replay.
