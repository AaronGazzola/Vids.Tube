## 1. Heartbeat store

- [x] 1.1 `npx supabase migration new worker_heartbeat`; add a heartbeat store
  (`worker_heartbeats(channel_id, last_heartbeat_at)` or a single-row `worker_status`)
  with RLS: owner-readable, worker-writable (secret key)
- [x] 1.2 Add a shared `WORKER_HEARTBEAT_STALE_MS` constant (worker + app) and an
  app-side helper/action to read whether the worker is fresh
- [x] 1.3 `npx supabase db push`; regenerate types

## 2. Engagement window (`worker/lib/streams.ts`)

- [x] 2.1 Change `resolveEligibleStream` to select the channel's active public stream
  (`status = 'live'` OR `(scheduled_start_at IS NOT NULL AND status IN ('scheduled','preview'))`)
  instead of `status = 'live'`
- [x] 2.2 Return the stream's `status` (and `youtube_video_id`) so the dispatcher can
  gate jobs; keep the per-stream lock unchanged

## 3. Per-status dispatch (`worker/index.ts`)

- [x] 3.1 In `tick()`, run scoring, YouTube-chat polling, and moderation whenever the
  engaged stream is public and their settings are on
- [x] 3.2 Run `runTranscriptionJob` only when `status === 'live'`
- [x] 3.3 Upsert the heartbeat every tick (even when no stream is eligible)

## 4. Job guards

- [x] 4.1 `worker/jobs/transcribe.ts`: assert/guard `status === 'live'` so it never
  runs pre-live
- [x] 4.2 Confirm `worker/jobs/score.ts` and `worker/lib/youtube-chat.ts` operate on
  a `scheduled`/`preview` stream (they key off chat + settings, not status)

## 5. Verification

- [x] 5.1 `npx tsc --noEmit` and `npx eslint` on `worker/` pass
- [ ] 5.2 Script test (remote db): a dated `scheduled` stream with scoring on is
  engaged, its chat is scored/moderated and YouTube-polled, and no
  `transcript_segments` are written until it is `live`; the heartbeat row updates
  each tick; a `draft`/ad-hoc `preview` is NOT engaged
