## Why

`redesign-stream-lifecycle` now keeps a broadcast `live` across encoder
disconnects (recording reconnect gaps, ending only via the owner's End action).
That backend change needs matching front-of-house behaviour:

- The public player and the owner preview currently freeze / go blank when the
  feed stalls, and `getLiveStreamAction` even downgrades a stale `live` row to
  `ended`, making the stream vanish. With disconnect-tolerant live, a stalled feed
  should read as **"Disconnected — waiting to resume"** while the stream stays live
  and chat stays open, then resume automatically on reconnect.
- The `/live` End button must be **guarded**: ending while the encoder is still
  connected would immediately respawn an ad-hoc preview, so End must refuse (with a
  dialog to stop the encoder first) until the feed is disconnected.
- The finished VOD is a single MP4 with **jump cuts** at each reconnect (the
  disconnected time isn't recorded). Chat replay is wall-clock based, so it drifts
  after a cut. Replay must become **gap-aware**: map video time to wall-clock minus
  prior gaps, and clamp messages sent during a gap to the cut point so they all load
  in exactly when the video jumps, then continue in sync.

## What Changes

- **Disconnected live state** (public `channel-live` + owner `/live` preview): when
  `status = live` and `last_seen_at` is stale, show a Disconnected overlay instead
  of a frozen player; keep chat open (read + write); auto-resume playback when the
  feed returns. `getLiveStreamAction` no longer maps stale `live → ended`; it
  reports live + a stale/disconnected signal.
- **End-stream connection guard** (`/live`): the End action already refuses a
  connected encoder (see `stream-lifecycle`); the toolbar surfaces this as a dialog
  ("Stop the stream in OBS first, then try again") rather than a silent no-op.
- **Gap-aware chat replay** (`watch`): consume `stream_gaps` to convert each
  message's wall-clock offset into video time, clamping in-gap messages to the cut.

## Capabilities

### New Capabilities

- `live-connection-state`: the Disconnected live state on the public surface and the
  owner preview, plus the End-stream connection guard dialog.

### Modified Capabilities

- `broadcast-chat-replay`: VOD chat replay becomes gap-aware so it stays in sync
  across the jump cuts a reconnected broadcast produces.

## Impact

- Depends on `redesign-stream-lifecycle` (the `stream_gaps` table, the
  disconnect-keeps-live offline route, the End-requires-disconnect action, and the
  finalize-on-end VOD concat).
- `app/layout.actions.ts` (`getLiveStreamAction` stale handling), the live player /
  stage components, `app/watch/[videoId]` chat-replay action + `lib/chat-replay.ts`.
- Composes with `unify-live-stream-page` (the End dialog and the preview Disconnected
  state render inside the `/live` page it builds).
