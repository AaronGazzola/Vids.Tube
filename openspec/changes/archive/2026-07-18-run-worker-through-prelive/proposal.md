## Why

The local worker (transcription, chat scoring, YouTube-chat polling, moderation)
only engages `status = 'live'` streams (`worker/lib/streams.ts` selects
`.eq('status','live')`). But the new lifecycle gives a scheduled broadcast a public
**waiting room with live chat before go-live**, and that chat needs moderation,
scoring, and YouTube-chat merge during the wait. The app also needs to know whether
the worker is running so it can warn the owner when scheduling (see
`add-waiting-room-chat`) and show a running/stopped indicator.

Transcription and VOD recording, by contrast, must stay **live-only**: there is no
public audio feed to transcribe (or record) before go-live.

## What Changes

- **Engage public streams, not just live.** The worker SHALL engage any stream that
  is public per the lifecycle rule
  (`(scheduled_start_at IS NOT NULL AND status IN ('scheduled','preview')) OR status = 'live'`),
  reusing the same per-stream lock. This covers a dated `scheduled` waiting room, its
  `preview` (owner connected, audience still waiting), and `live`.
- **Per-status job gating.** While engaged:
  - Chat moderation (auto-hide, ban/suggest per mode), YouTube-chat polling, and chat
    scoring run whenever the stream is public (`scheduled`/`preview`/`live`) and the
    relevant setting is on.
  - Transcription runs **only** while `status = 'live'`.
- **Worker heartbeat.** The worker SHALL write a heartbeat (a `worker_heartbeats`
  row, or a channel-scoped `last_heartbeat_at`) on each poll tick, so the app can
  determine "worker running" within a freshness window. This is the signal the
  scheduling validation and the reminder component consume.

## Capabilities

### Modified Capabilities

- `local-worker`: engagement window widened from live-only to public
  (`scheduled`/`preview`/`live`); per-status job dispatch; adds the heartbeat.
- `stream-transcription`: the whisper/transcription job is explicitly gated to
  `status = 'live'` so widening engagement does not start transcription pre-live.

## Impact

- `worker/lib/streams.ts` (`resolveEligibleStream` selection), `worker/index.ts`
  (dispatcher: pick jobs by status), `worker/jobs/transcribe.ts` (live gate),
  `worker/jobs/score.ts` and `worker/lib/youtube-chat.ts` (run pre-live).
- Migration: a heartbeat store (`worker_heartbeats` table, or a column) plus a
  freshness threshold constant shared with the app.
- Depends on `redesign-stream-lifecycle` for the public-visibility rule, the `draft`
  status, and `created_in_ui`. Consumed by `add-waiting-room-chat` (validation +
  reminder) and surfaced in `unify-live-stream-page` (reminder indicator).
- Non-goal: VOD recording gating lives in `redesign-stream-lifecycle`
  (`live_at`); this change only governs the worker's jobs.
