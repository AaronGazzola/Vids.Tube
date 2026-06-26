## ADDED Requirements

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
job module, so that future jobs (chat scoring, shorts) can be added without
restructuring the worker. This change SHALL include only the transcription job;
the dispatcher SHALL be structured so additional job modules drop in as siblings.

#### Scenario: Transcription job runs under the dispatcher

- **WHEN** the worker starts and a live stream is eligible
- **THEN** the dispatcher invokes the transcription job module, and the worker's
  structure allows a future job module to be added without changing the
  transcription job

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
