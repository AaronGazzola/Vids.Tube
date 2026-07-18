## Why

Viewers often spot the best moments first. `!clip` lets them drop a timestamped
marker with surrounding transcript context, giving the owner a ready shortlist
for cutting YouTube shorts from the VOD after the stream.

## What Changes

- **`clip_markers`** table: stream time (seconds since go-live), requester
  identity/origin, the surrounding transcript snippet, created_at. Owner-only
  read, service-role writes.
- **`clip` builtin** (cooldown 60s): records the marker at the current stream
  time with the last transcript lines as context and acks in chat that the clip
  was recorded and may become a YouTube short.
- **Clip markers panel** in the /live Activity tab: lists markers (timestamp,
  requester, snippet) for the active stream — and for the most recent ended
  stream when nothing is active, so the shortlist is right there after the
  show.

## Capabilities

### New Capabilities

- `clip-command`: the marker capture with transcript context, the ack, and the
  owner shortlist panel including its post-stream behavior.

## Non-goals / Related

- No automatic clip cutting — markers are input to the owner's editing flow.

## Impact

- Migration: `clip_markers` + `clip` seed + types regen.
- `worker/lib/clip-command.ts` + handler registration; Activity panel + action/
  hook; `scripts/verify-clip.ts`; e2e for the panel.
