## MODIFIED Requirements

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

The dispatcher SHALL do nothing with a broadcast once engagement ends beyond releasing its lock.
Settling a finished broadcast SHALL NOT run from the live worker, so the worker can be stopped
the moment a broadcast ends without losing work that was about to happen.

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

#### Scenario: Stopping the worker after a broadcast loses nothing

- **WHEN** a broadcast ends and the worker process is stopped immediately
- **THEN** no post-broadcast work was pending in that process, and the broadcast is settled later
  by the maintenance runner
