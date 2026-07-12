## 1. Disconnected live state (data)

- [x] 1.1 `getLiveStreamAction` (`app/layout.actions.ts`): stop mapping a stale
  `live` row to `ended`; return the row unchanged so the client can detect
  disconnection from `status` + `last_seen_at`
- [x] 1.2 Add a small `isFeedDisconnected(stream, now)` helper (`status==='live' &&
  now − last_seen_at > STALE_MS`) shared by the player and the `/live` toolbar

## 2. Disconnected live state (UI)

- [x] 2.1 Public player/stage (`components/live-stage.tsx` / `live-player.tsx`):
  when disconnected, overlay "Disconnected — waiting for the stream to resume" over
  the last frame instead of freezing/erroring; keep polling and auto-resume
- [x] 2.2 Keep the live chat mounted and writable while disconnected (no change
  beyond not unmounting it)
- [x] 2.3 Owner `/live` Preview tab: reuse the same disconnected overlay

## 3. End-stream connection guard (UI)

- [x] 3.1 `/live` status toolbar: when the feed is still fresh (encoder connected),
  the End button opens a dialog — "Stop the stream in OBS first, then try again" —
  and does not call End
- [x] 3.2 When disconnected, End proceeds through its normal confirm → `endStreamAction`

## 4. Gap-aware chat replay

- [x] 4.1 `getStreamChatReplayAction` (`app/watch/[videoId]/page.actions.ts`): fetch
  the stream's `stream_gaps` and `live_at`; base offsets on `live_at` (fallback to
  `started_at` when absent, no gaps)
- [x] 4.2 `lib/chat-replay.ts`: add gap-aware `videoMs` computation (subtract prior
  gap durations; clamp in-gap messages to the cut) and use it in `toReplayMessages`
- [x] 4.3 Keep `visibleReplayMessages` unchanged (it compares `currentTimeMs` to the
  precomputed `videoMs`)

## 5. Verification

- [x] 5.1 `npx tsc --noEmit`, `npx eslint`, `doppler run -- npm run build` pass
- [x] 5.2 Unit test `lib/chat-replay.ts` gap math: message before a gap, inside a
  gap (clamped to cut), and after a gap (shifted by gap duration)
- [ ] 5.3 Script/manual: a stale `live` row reads as disconnected (not ended) and
  chat still posts; a VOD with one gap replays chat in sync across the jump
