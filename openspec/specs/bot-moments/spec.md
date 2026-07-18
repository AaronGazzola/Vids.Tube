# bot-moments Specification

## Purpose

Bot-initiated stream messages under owner control: a projects list feeding
links, three independently toggled proactive moment types (useful info,
competition status, progress updates), and an owner-fired one-shot wrap-up
trio (MVP, AI achievement summary, thanks with links).

## Requirements

### Requirement: Channel projects list

The system SHALL store a per-channel projects list (name, blurb, domain URL,
repo URL) managed from a Settings section, feeding progress updates, wrap-up
links, and `!ask` grounding. Bot messages SHALL only ever link to these
configured URLs.

#### Scenario: Project managed and used

- **WHEN** the owner adds a project with its domain and repo
- **THEN** progress updates and the wrap-up thanks message can include that
  project with its links

### Requirement: Proactive bot moments behind independent toggles

The system SHALL provide three independently toggleable proactive behaviors,
each posting to both chats on its own interval while the worker is engaged and
silent when toggled off: **Useful info** — periodically inspect the recent
transcript for a factual musing and answer it only when confidently known;
**Competition status** — periodic top-three leaderboard posts, skipped when no
one has scored; **Progress update** — periodic posts naming the configured
projects with their links.

#### Scenario: Useful info answers a musing

- **WHEN** useful-info is on and the streamer wonders aloud about a factual
  question the model confidently knows
- **THEN** the bot posts the answer in chat within the check interval

#### Scenario: Toggled off means silent

- **WHEN** a proactive toggle is off
- **THEN** that moment type never posts, regardless of intervals

#### Scenario: Competition status skips an empty board

- **WHEN** competition status is on but no viewer has scored
- **THEN** no leaderboard post is made

### Requirement: Owner-fired wrap-up

The system SHALL end-of-stream message only on the owner's explicit "Wrap up"
action (a confirmed button in the Activity tab), never automatically. The
wrap-up SHALL send, exactly once per stream, whichever of three messages are
enabled in Settings: the MVP announcement (top scorer with points), an AI
summary of what was achieved from the transcript, and a thanks-for-watching
message with the project links. A second wrap-up request for the same stream
SHALL do nothing.

#### Scenario: Wrap-up sends the enabled trio

- **WHEN** the owner confirms Wrap up with all three messages enabled
- **THEN** the bot posts the MVP, the achievement summary, and the thanks
  message (with project links) to both chats, once

#### Scenario: Wrap-up respects the toggles

- **WHEN** only the thanks message is enabled
- **THEN** wrap-up sends the thanks message and nothing else

#### Scenario: Wrap-up is idempotent

- **WHEN** Wrap up is requested twice for one stream
- **THEN** the messages send only once
