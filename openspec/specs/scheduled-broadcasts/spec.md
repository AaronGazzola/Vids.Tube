# scheduled-broadcasts Specification

## Purpose
TBD - created by archiving change add-scheduled-broadcasts. Update Purpose after archive.
## Requirements
### Requirement: Create a scheduled broadcast ahead of time

The system SHALL let the channel owner create/configure the single active broadcast
before any encoder connects, capturing an optional title, description, thumbnail,
overlay settings, and an optional `scheduled_start_at`. With a datetime the row is
`status='scheduled'` (public waiting room); without a datetime it is `status='draft'`
(private). Both are created with `created_in_ui=true`. Because at most one active
stream may exist, saving SHALL edit the existing active row when one exists rather
than creating a second. A non-empty title is NOT required to create/save; it is
required only to go live (see `broadcast-setup`).

#### Scenario: Owner creates a private draft

- **WHEN** the owner saves broadcast settings with no scheduled datetime and no
  active stream exists
- **THEN** the system stores a `streams` row with `status='draft'`, `created_in_ui=true`,
  private to the owner

#### Scenario: Owner schedules a dated broadcast

- **WHEN** the owner saves broadcast settings with a scheduled datetime
- **THEN** the active row is `status='scheduled'` with that `scheduled_start_at`,
  public as a waiting room/coming-soon card

#### Scenario: Saving edits the existing active row

- **WHEN** the owner saves settings while an active `draft`/`scheduled`/`preview`/`live`
  row exists
- **THEN** the existing active row is updated in place; no second active row is created

#### Scenario: Only the owner can create

- **WHEN** an anonymous or non-owner user attempts to create/edit the broadcast
- **THEN** the system rejects the request and creates no row

### Requirement: Scheduled-broadcast thumbnail upload

The system SHALL let the owner upload a thumbnail for a scheduled broadcast, storing
it in the VOD object store (R2/CDN) so its URL resolves through the same path as VOD
media, and recording the stored key as the broadcast's `thumbnail_path`.

#### Scenario: Owner uploads a thumbnail when scheduling

- **WHEN** the owner uploads an image while creating or editing a scheduled broadcast
- **THEN** the system stores it in the VOD object store, sets the broadcast's
  `thumbnail_path` to its key, and the thumbnail renders from the CDN

### Requirement: Edit a scheduled broadcast

The system SHALL let the owner edit the active scheduled broadcast's title,
description, thumbnail, and start time from the `/live` Settings tab while it is
still pre-live, persisting the changes on the same active `streams` row. A non-empty
title is NOT required to save (it is required only to go live — see
`broadcast-setup`); clearing the start time turns the broadcast back into a private
`draft`.

#### Scenario: Owner edits a scheduled broadcast

- **WHEN** the owner changes the title, description, thumbnail, or start time of the
  active `scheduled` broadcast
- **THEN** the system stores the new values on that row and reflects them on the
  public coming-soon surface

### Requirement: Cancel a scheduled broadcast

The system SHALL let the owner discard the active pre-live broadcast
(`draft`/`scheduled`/`preview`), which supersedes the prior cancel action. For
`draft`/`scheduled` (no encoder) the row SHALL be deleted, removing it from the
upcoming/coming-soon surfaces so it can never be claimed. For `preview` (encoder
connected) the row SHALL be reset in place to a blank private ad-hoc preview (see
`stream-lifecycle` Discard). Discard SHALL never create a VOD.

#### Scenario: Owner discards an upcoming broadcast

- **WHEN** the owner discards a `draft` or `scheduled` broadcast
- **THEN** the row and its per-stream data are deleted, it no longer renders as a
  coming-soon card, and a subsequent encoder connect does not claim it

#### Scenario: Owner discards while previewing

- **WHEN** the owner discards while `preview`
- **THEN** the row is reset to a blank private ad-hoc preview instead of deleted, and
  no VOD is created

### Requirement: Missed scheduled broadcasts

The system SHALL keep a `scheduled` broadcast whose `scheduled_start_at` has passed
as the channel's single active row: it remains on the public waiting-room surface
(countdown elapsed) and remains claimable by a connecting encoder (see
`stream-lifecycle` and `stream-pipeline` — there is no grace window). The owner
clears a missed broadcast by discarding it, or supersedes it by connecting the
encoder and going live from it.

#### Scenario: Past-dated scheduled broadcast is still claimable

- **WHEN** the encoder connects while the active `scheduled` row's start time has
  already passed
- **THEN** the system claims that row into `preview`, preserving its settings, and
  creates no second row

#### Scenario: Owner discards a missed broadcast

- **WHEN** the owner discards a past-dated `scheduled` broadcast
- **THEN** the row and its per-stream data are deleted and no active stream remains

### Requirement: Coming-soon card on the channel page

The system SHALL render a coming-soon card for the channel's scheduled/preview
stream slot (on the standalone live page `/[channelSlug]/live`) when the channel
is not live and has an upcoming `scheduled` broadcast (status `scheduled` with a
future `scheduled_start_at`) or a connected `preview`. The card SHALL show the
broadcast's thumbnail, title, and a countdown to its start time. When the channel
has no live, preview, or upcoming scheduled broadcast, the slot SHALL render
nothing — no static offline placeholder and no "no stream scheduled" card.

#### Scenario: Upcoming broadcast shows a countdown

- **WHEN** a viewer opens `/[channelSlug]/live` while the channel is not live and an
  upcoming scheduled broadcast exists
- **THEN** the page shows a coming-soon card with the broadcast's thumbnail, title,
  and a countdown to `scheduled_start_at`, in place of the live player

#### Scenario: No upcoming broadcast renders nothing

- **WHEN** the scheduled/preview slot is evaluated for a channel that is not live
  and has no upcoming scheduled or preview broadcast
- **THEN** no card is rendered for the slot — no static offline placeholder and no
  "No stream scheduled right now" box appears

#### Scenario: Going live replaces the coming-soon card

- **WHEN** the owner goes live (the broadcast becomes public `live`)
- **THEN** the live page replaces the coming-soon card with the live player and
  chat

### Requirement: Format-aware scheduled-broadcast thumbnails

The system SHALL render a scheduled broadcast's thumbnail uncropped regardless of
its orientation, using the same fixed 16:9 container as before. Where a broadcast
thumbnail is shown — the channel coming-soon card (`components/scheduled-card.tsx`),
the studio Broadcasts rows and the schedule/edit dialog preview
(`app/studio/broadcasts/page.tsx`) — a portrait thumbnail SHALL be shown
uncropped (`object-contain`) centered over a blurred, scaled copy of the same
image that fills the side bars, and a landscape thumbnail SHALL fill the
container (`object-cover`) as before. Orientation SHALL be determined at runtime
from the thumbnail image's intrinsic dimensions (`naturalWidth`/`naturalHeight`
on the image's `load` event); broadcasts carry no stored dimensions, so the
thumbnail SHALL be treated as landscape until it loads. No orientation selector
SHALL be added to the schedule/edit dialog.

#### Scenario: Portrait coming-soon card

- **WHEN** the channel coming-soon card shows a portrait thumbnail
  (`naturalHeight > naturalWidth`)
- **THEN** the full thumbnail is shown uncropped, centered over a blurred fill of
  the same image inside the 16:9 card, with the countdown overlay unchanged on top

#### Scenario: Portrait thumbnail in the studio Broadcasts list

- **WHEN** the owner views the Broadcasts page and a row's thumbnail is portrait
- **THEN** the row thumbnail shows the full image uncropped over a blurred fill,
  in the same fixed thumbnail box, so rows stay uniform

#### Scenario: Portrait thumbnail preview in the schedule/edit dialog

- **WHEN** the owner has set (or is editing) a portrait thumbnail in the
  schedule/edit dialog
- **THEN** the dialog preview shows the full portrait thumbnail uncropped over a
  blurred fill rather than a center-cropped strip, and the dialog offers no
  vertical/landscape selector

#### Scenario: Landscape thumbnails unchanged

- **WHEN** a broadcast thumbnail is landscape (or not yet loaded)
- **THEN** it fills its 16:9 container (`object-cover`) exactly as before

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

