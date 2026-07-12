## ADDED Requirements

### Requirement: Waiting-room chat setting

The system SHALL provide a per-broadcast `waiting_room_chat` toggle on the active
stream. When on, the public scheduled waiting room has an active chat before go-live;
when off, the waiting room shows only the countdown. The setting SHALL be stored on
the stream so it is fixed for that broadcast.

#### Scenario: Waiting-room chat enabled

- **WHEN** a dated `scheduled` broadcast has `waiting_room_chat = true`
- **THEN** its public waiting room shows the live chat and accepts posts (auth
  required)

#### Scenario: Waiting-room chat disabled

- **WHEN** a dated `scheduled` broadcast has `waiting_room_chat = false`
- **THEN** its public waiting room shows only the countdown, with no chat

### Requirement: Schedule-save validation

The system SHALL, when the owner saves broadcast settings that persist a
`scheduled_start_at`, check that the local worker is running (heartbeat within
`WORKER_HEARTBEAT_STALE_MS`) and that a YouTube URL is set on the broadcast. If
either is missing, the system SHALL show a confirmation dialog naming what is missing
and its effect — worker down means no moderation/scoring during the wait; no YouTube
URL means no YouTube chat merged — and SHALL offer Schedule anyway or Fix first,
committing the schedule only on Schedule anyway.

#### Scenario: Worker not running when scheduling

- **WHEN** the owner saves with a scheduled datetime and the worker heartbeat is stale
- **THEN** a confirmation explains moderation/scoring will be inactive during the wait
  and offers Schedule anyway or Fix first

#### Scenario: YouTube URL missing when scheduling

- **WHEN** the owner saves with a scheduled datetime and no YouTube URL is set
- **THEN** a confirmation explains YouTube chat will not be merged and offers Schedule
  anyway or Fix first

#### Scenario: All prerequisites satisfied

- **WHEN** the owner saves with a scheduled datetime, the worker is fresh, and a
  YouTube URL is set
- **THEN** no validation dialog is shown for missing prerequisites

### Requirement: First-time-schedule confirmation

The system SHALL, when a save transitions the active broadcast from having no
`scheduled_start_at` to having one, show a confirmation explaining that a public scheduled
page with a countdown will be displayed, and — when `waiting_room_chat` is on — that
the waiting-room chat will be public. When missing prerequisites also apply, the
system SHALL present both concerns in one dialog before committing.

#### Scenario: Newly scheduling a previously undated broadcast

- **WHEN** the owner saves a datetime onto a broadcast that had none
- **THEN** a confirmation explains the public scheduled page will appear, adds the
  public-chat note if `waiting_room_chat` is on, and commits only on confirm
