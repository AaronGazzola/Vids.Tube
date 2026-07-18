## Why

`!me` is the flagship identity command: a viewer asks and the bot answers with a
warm AI mini-bio of their history on the channel — YouTube history from the
backfilled archive, vids.tube history from live scoring, merged when the viewer
has verified their YouTube handle link. Profiles are cached so replies are
instant and Claude is only called when a chatter's stats have moved.

## What Changes

- **`me_profiles`** cache table: one row per identity key (`youtube:<channelId>`
  or `user:<userId>`) holding the generated bio plus the stats snapshot it was
  generated from; regenerated only when total messages moved by ≥ 20 or the
  videos/streams-attended count changed.
- **`!me` builtin** (registry row seeded: cooldown 600s): the worker resolves
  the caller's identity — YouTube chatters by channel id; vids.tube chatters by
  user id, merged with their YouTube history when a **verified**
  `youtube_links` row exists — gathers stats (`chatter_stats` for YouTube;
  aggregated `viewer_scores` for vids.tube), serves the cached bio when fresh,
  otherwise generates one via the worker's Claude CLI with a warm/playful
  prompt, hard-capped at 400 characters by prompt instruction AND truncation
  before caching.
- **First-timers** (no history anywhere) get a fixed welcome line with no AI
  call.

## Capabilities

### New Capabilities

- `me-command`: identity resolution and merging, the stats gathering, the cached
  AI profile with regeneration thresholds and the 400-char cap, and the
  first-timer welcome.

## Non-goals / Related

- Tone/wording beyond "warm and playful" is generation detail, not spec.
- Unverified handle links do NOT merge (anyone could type someone else's
  handle); verification is the merge gate.

## Impact

- Migration: `me_profiles` + seed the `me` registry row + types regen.
- New `worker/lib/me-command.ts` registered in `BUILTIN_HANDLERS`.
- `scripts/verify-me-command.ts` end-to-end worker verification.
