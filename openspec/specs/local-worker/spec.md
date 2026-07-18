# local-worker Specification

## Purpose
TBD - created by archiving change add-local-worker-transcription. Update Purpose after archive.
## Requirements
### Requirement: Single out-of-process local worker

The system SHALL provide one local worker process, run outside the deployed
Next.js app, that performs the work the app cannot run on Vercel (`whisper.cpp`,
`ffmpeg`, and the Claude subscription via `claude -p`). The worker SHALL live in a
top-level `worker/` directory, run via `tsx`, take its secrets from Doppler, and
hold the Supabase **secret key** locally. It SHALL reuse the app's
`supabase/admin-client.ts`, `supabase/types.ts`, and `lib/r2.ts` rather than
duplicating them, and SHALL NOT introduce any Anthropic SDK or API key into the
deployed app.

#### Scenario: Worker runs outside the Next build

- **WHEN** the worker is started with `tsx worker/...` under `doppler run`
- **THEN** it executes as its own process using the Supabase secret key, and the
  deployed Next.js app contains no Anthropic API key and no LLM code

#### Scenario: Worker reuses app modules

- **WHEN** the worker reads or writes Supabase or R2
- **THEN** it uses the app's `supabaseAdmin` client, generated `Database` types,
  and `lib/r2.ts` helpers rather than its own copies

### Requirement: Job dispatcher with jobs as separate modules

The worker SHALL run a dispatcher loop under which each unit of work is a separate
job module. The dispatcher SHALL engage the channel's active **public** stream —
`status = 'live'` OR
`(scheduled_start_at IS NOT NULL AND status IN ('scheduled','preview'))` — not only
`live`, and SHALL NOT engage private streams (`draft`, or ad-hoc `preview` with
`created_in_ui = false` and no datetime). While a stream is engaged the dispatcher
SHALL gate jobs by status: chat scoring, YouTube-chat polling, and moderation run
whenever the stream is public and their settings are enabled; the transcription job
runs only while `status = 'live'`. The per-stream lock is reused unchanged.

#### Scenario: Scheduled waiting room is moderated and scored

- **WHEN** the worker polls and the channel's active stream is a dated `scheduled`
  (or its `preview`) with scoring enabled
- **THEN** the dispatcher runs scoring, YouTube-chat polling, and moderation on that
  stream's chat, and does not run transcription

#### Scenario: Transcription waits for live

- **WHEN** the engaged stream is `scheduled` or `preview`
- **THEN** the dispatcher does not invoke the transcription job

#### Scenario: Private streams are not engaged

- **WHEN** the channel's active stream is `draft`, or an ad-hoc `preview`
  (`created_in_ui = false`, no datetime)
- **THEN** the dispatcher engages no jobs for it

### Requirement: Doctor preflight check

The worker SHALL provide a `doctor` command that verifies its external
dependencies are present and reachable — the `whisper-cli` binary and its model,
`ffmpeg`, the `claude` CLI, and the Supabase connection — and reports a clear
failure with remediation when any is missing, before any job runs.

#### Scenario: Doctor passes when the environment is ready

- **WHEN** `worker doctor` runs on a machine with `whisper-cli` + model, `ffmpeg`,
  `claude`, and a reachable Supabase
- **THEN** it reports success for each check

#### Scenario: Doctor fails loudly on a missing binary

- **WHEN** `worker doctor` runs and `whisper-cli` (or its model, `ffmpeg`, or
  `claude`) is missing
- **THEN** it reports which dependency is missing and exits non-zero rather than
  letting a job fail later

### Requirement: Worker heartbeat

The worker SHALL write a heartbeat timestamp on every poll tick while its process is
alive, regardless of whether a stream is eligible, so the app can determine whether
the worker is running within a shared freshness window (`WORKER_HEARTBEAT_STALE_MS`).
The heartbeat store SHALL be owner-readable and writable only by the secret-key
worker.

#### Scenario: Heartbeat updates each tick

- **WHEN** the worker completes a poll tick
- **THEN** it upserts its heartbeat with the current time

#### Scenario: App reads worker availability

- **WHEN** the app checks worker availability and the last heartbeat is within
  `WORKER_HEARTBEAT_STALE_MS`
- **THEN** the worker is reported as running; otherwise it is reported as stopped

