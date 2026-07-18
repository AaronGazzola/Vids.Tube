## Context

`stream_gaps` rows (from `redesign-stream-lifecycle`) record each live disconnect
as `[gap_start_at, gap_end_at]`. The VM concatenates only recorded (connected)
footage, so the VOD omits gap time entirely — a jump cut, not black. Existing
replay (`lib/chat-replay.ts`, `app/watch/[videoId]/page.actions.ts`) offsets each
message by `created_at − started_at` (wall-clock) and shows it when the player's
`currentTimeMs` passes that offset. After a cut, wall-clock > video time, so replay
runs ahead.

## Decisions

### Disconnected live state

- `getLiveStreamAction` stops returning `status:'ended'` for a stale `live` row.
  It returns the row as-is; the client derives `disconnected = status==='live' &&
  now − last_seen_at > STALE_MS`.
- The player component, when `disconnected`, overlays "Disconnected — waiting for
  the stream to resume" over the last frame (or a placeholder) instead of erroring.
  It keeps polling the stream + HLS and resumes automatically when `last_seen_at`
  refreshes and segments return.
- Chat is unaffected: the stream is still `live`, so read + write continue (RLS and
  UI already gate on `live`).
- The owner `/live` Preview tab reuses the same disconnected treatment.

### End-stream connection guard (UI)

- The End action (in `stream-lifecycle`) returns an expected error when the encoder
  is still connected. The `/live` toolbar detects the connected state up front
  (fresh `last_seen_at`) and shows a confirmation-style dialog: "Your encoder is
  still connected. Stop the stream in OBS first, then press End." It does not call
  End while connected; once disconnected, End proceeds (with its own confirm).

### Gap-aware chat replay

Given ordered gaps `g_i = [s_i, e_i]` (wall-clock) and `live_at = L`:

- Video time of a message at wall-clock `t`:
  - Let `G(t) = Σ (min(t, e_i) − s_i)` over gaps with `s_i < t` (time removed before `t`).
  - If `t` falls inside a gap `g_i` (`s_i ≤ t < e_i`): clamp to the cut →
    `videoMs = s_i − L − Σ_{j<i}(e_j − s_j)`.
  - Else: `videoMs = (t − L) − G(t)`.
- Messages sharing a cut collapse to the same `videoMs`, so they all become visible
  the instant the player reaches the jump, then replay continues in sync.
- The replay action fetches the stream's `stream_gaps` (and `live_at`) alongside the
  messages and precomputes each message's `videoMs`; `visibleReplayMessages` keeps
  its existing "show when currentTimeMs ≥ offset" logic against `videoMs`.
- Baseline change: offsets are computed from `live_at` (the VOD start), not
  `started_at` (preview connect), matching the trimmed VOD.

## Risks / Migration

- An open gap (`gap_end_at IS NULL`) at End is closed to `ended_at` before replay
  math runs, so no unbounded gap.
- Replay for legacy VODs with no `stream_gaps` and no `live_at` falls back to the
  current `started_at`-based offsets (no gaps) — unchanged behaviour.
