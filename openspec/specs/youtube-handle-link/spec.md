# youtube-handle-link Specification

## Purpose

Let a vids.tube user link their YouTube identity without OAuth: a typed handle
resolved to a channel id server-side, verified by posting a short code in the
owner's YouTube live chat from that channel, so viewer history merges across
platforms.
## Requirements
### Requirement: User-level YouTube link storage

The system SHALL store at most one YouTube link per vids.tube user
(`youtube_links`: user id, verify code, and — once verified — the linked YouTube
channel id and canonical handle). The verify code SHALL be unique across users so
the code alone identifies the account. The YouTube channel id and handle MAY be
null before verification (a code can exist before any channel is known). A user
SHALL be able to read only their own row, and all writes SHALL go through
authenticated server actions or the worker using the service role so a user
cannot set their own `verified_at`.

#### Scenario: One link per user

- **WHEN** a user requests a verify code while already having a link row
- **THEN** the existing row is reused, never a second row

#### Scenario: Code exists before a channel is known

- **WHEN** a signed-in user is issued a verify code without typing a handle
- **THEN** a link row is stored with the code and null channel id/handle until verification

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

The system SHALL verify link ownership through the owner's YouTube live chat using
the code alone: while the worker is engaged, a YouTube-origin chat message whose
trimmed text equals an outstanding unverified verify code SHALL link the posting
channel to the account that owns that code — setting the link's `youtube_channel_id`
and `youtube_handle` from the message author and marking it verified. If the posting
channel is already verified-linked to a different account, the message SHALL be
ignored. Verification SHALL then trigger the identity merge for that user.

#### Scenario: Code posted from any channel links that channel

- **WHEN** a YouTube channel posts exactly an outstanding verify code in the owner's
  live chat while the worker is engaged
- **THEN** that channel id and handle are stored on the code's account, the link is
  marked verified, and the identity merge runs for that user

#### Scenario: Channel already linked elsewhere is ignored

- **WHEN** the posting channel is already verified-linked to a different account
- **THEN** the code does not re-link it and no account changes

#### Scenario: Unknown code is ignored

- **WHEN** a YouTube message's text matches no outstanding unverified code
- **THEN** nothing is verified

