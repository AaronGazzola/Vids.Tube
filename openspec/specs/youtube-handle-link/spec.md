# youtube-handle-link Specification

## Purpose

Let a vids.tube user link their YouTube identity without OAuth: a typed handle
resolved to a channel id server-side, verified by posting a short code in the
owner's YouTube live chat from that channel, so viewer history merges across
platforms.

## Requirements

### Requirement: User-level YouTube link storage

The system SHALL store at most one YouTube link per vids.tube user
(`youtube_links`: user id, claimed channel id, canonical handle, verify code,
verified-at). A user SHALL be able to read only their own row, and all writes
SHALL go through authenticated server actions using the service role so a user
cannot set their own `verified_at`.

#### Scenario: One link per user

- **WHEN** a user saves a YouTube handle while already having a link
- **THEN** the existing row is replaced (new channel id, new code, verification
  reset), never a second row

#### Scenario: verified_at is server-controlled

- **WHEN** a client attempts to write `youtube_links` directly
- **THEN** row-level security rejects the write

### Requirement: Handle resolution on save

The system SHALL resolve a typed handle to a YouTube channel via the YouTube
Data API (`channels.list?forHandle`, API key) at save time, storing the channel
id and the canonical handle, and SHALL return a user-facing error when the
handle matches no channel. Leading `@` and surrounding whitespace SHALL be
tolerated.

#### Scenario: Handle resolves

- **WHEN** a user saves ` @SomeCreator `
- **THEN** the link stores that channel's id and canonical handle and shows the
  resolved channel name

#### Scenario: Unknown handle

- **WHEN** a user saves a handle that matches no YouTube channel
- **THEN** no link is stored and a clear error explains the handle was not found

### Requirement: Chat-code verification

The system SHALL verify link ownership through the owner's YouTube live chat:
the account card shows a short code; while the worker is engaged, a
YouTube-origin chat message whose trimmed text equals an outstanding code AND
whose author channel id equals the claimed channel id SHALL mark the link
verified. A matching code from any other author SHALL be ignored. The card SHALL
show unverified state with instructions and the code, a control to generate a
new code, verified state once confirmed, and an Unlink action that deletes the
link.

#### Scenario: Code posted from the claimed channel verifies

- **WHEN** the claimed YouTube channel posts exactly the verify code in the
  owner's live chat while the worker is engaged
- **THEN** the link's `verified_at` is set and the card shows verified

#### Scenario: Code posted by someone else is ignored

- **WHEN** a different YouTube channel posts the same code
- **THEN** the link stays unverified

#### Scenario: Changing the handle resets verification

- **WHEN** a verified user saves a different handle
- **THEN** the link becomes unverified with a fresh code
