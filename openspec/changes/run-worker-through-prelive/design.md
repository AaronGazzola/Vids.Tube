## Context

- `worker/index.ts` — `tick()` calls `resolveEligibleStream()`, acquires a per-stream
  lock (`tryAcquireLock`/`releaseLock`), then `Promise.all([runTranscriptionJob,
  runScoringJob])`; loops every `pollMs`.
- `worker/lib/streams.ts` — `resolveEligibleStream()` selects the newest
  `status = 'live'` stream; lock helpers write to a per-stream lock row.
- `worker/jobs/transcribe.ts` — pulls audio via RTMP, runs `whisper-cli`, writes
  `transcript_segments`.
- `worker/jobs/score.ts` — buffers chat, scores via `claude -p`, writes viewer
  scores / featured picks / moderation actions.
- `worker/lib/youtube-chat.ts` — polls YouTube live chat into `chat_messages`.
- Claude runs via the local `claude` CLI (`worker/lib/claude.ts` → `exec`), so the
  worker must run on the owner's machine (subscription), not the server.

## Decisions

### Engagement window

`resolveEligibleStream` selects the channel's active stream that is **public** per
the shared predicate, i.e. `status = 'live'` OR
`(scheduled_start_at IS NOT NULL AND status IN ('scheduled','preview'))`. Reuse the
existing per-stream lock unchanged. A private `draft` or ad-hoc `preview`
(`created_in_ui = false`, no datetime) is NOT engaged — no public audience, nothing
to moderate.

### Per-status dispatch

`tick()` branches on the engaged stream's `status`:

- Always (public): `runScoringJob` (if scoring enabled), YouTube-chat polling (if a
  `youtube_video_id` is set), and moderation (auto-hide always; ban auto/suggest per
  mode). These already read their enable flags from `chat_scoring_state` / the
  moderation mode.
- `status === 'live'` only: `runTranscriptionJob`.

Scoring and moderation already run off chat and settings, so widening their window
is mostly the selection change plus not starting transcription pre-live.

### Heartbeat

On each tick the worker upserts a heartbeat with `now()`. Store options:

- `worker_heartbeats(channel_id pk, last_heartbeat_at)` upserted per tick, or
- a single-row `worker_status` table.

Define `WORKER_HEARTBEAT_STALE_MS` (e.g. 2–3× `pollMs`) shared by the app; the app
considers the worker "running" when `now − last_heartbeat_at < WORKER_HEARTBEAT_STALE_MS`.
The worker heartbeats whenever the process is alive (even with no eligible stream),
so the app can confirm availability before a broadcast is scheduled. RLS: readable
by the owner; writable only by the secret-key worker.

## Risks

- The worker must be running for the whole public waiting period; if it is off, the
  waiting-room chat is unmoderated. The heartbeat + the scheduling warning
  (`add-waiting-room-chat`) mitigate this but do not start the worker.
- YouTube chat only exists once the YouTube live/premiere has a chat; polling before
  that yields nothing, which is acceptable (no error).
