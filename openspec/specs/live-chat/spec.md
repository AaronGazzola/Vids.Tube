# live-chat Specification

## Purpose
TBD - created by archiving change add-live-streaming-and-chat. Update Purpose after archive.
## Requirements
### Requirement: Public chat read

The system SHALL allow anyone, including anonymous viewers, to read a live
stream's chat messages in real time. Each message's author SHALL be presented as
the author's channel identity — the channel `@handle` and avatar resolved from
the channel whose `owner_user_id` equals the message's author `user_id` — and
SHALL link to that author's channel page. The author's channel display name SHALL
NOT be shown in chat. The system SHALL NOT render a raw or truncated user id as
the author.

#### Scenario: Anonymous viewer reads chat

- **WHEN** an anonymous viewer opens a live stream
- **THEN** they see existing chat messages and receive new messages in real time,
  each labelled with its author's channel handle and avatar

#### Scenario: Realtime message resolves its author

- **WHEN** a new chat message arrives over the realtime subscription
- **THEN** it is displayed with its author's channel handle and avatar,
  resolving the author from the loaded channel set or a lookup, without blocking
  the message from appearing

#### Scenario: Author has no resolvable channel

- **WHEN** a chat message's author `user_id` has no matching channel row
- **THEN** the message renders with a neutral placeholder identity (no raw user
  id, no error)

### Requirement: Authenticated chat posting

The system SHALL allow only authenticated users to post chat messages, persisted
to `chat_messages` with the author's user id, and SHALL surface a sign-in prompt
to anonymous viewers in place of the composer. The system SHALL limit a chat
message to a maximum of 200 characters (matching YouTube). The composer SHALL be a
multi-line, word-wrapping text area that does NOT truncate or block typing past the
limit; instead, as the limit is approached it SHALL display the number of
characters remaining, and once exceeded it SHALL visually mark the over-limit
characters (red), disable the send control, and show a message explaining the
input is over the limit. The server posting action SHALL reject a message whose
trimmed body exceeds 200 characters with a clear, user-facing expected error,
independent of the client.

#### Scenario: Authenticated user posts

- **WHEN** an authenticated user submits a chat message
- **THEN** the message is inserted with their user id and appears for all viewers
  in real time

#### Scenario: Anonymous user cannot post

- **WHEN** an anonymous viewer views the chat
- **THEN** the composer is replaced by a sign-in prompt and no message can be sent

#### Scenario: Insert integrity enforced by RLS

- **WHEN** any client attempts to insert a chat message with a user id other than
  its own
- **THEN** row-level security rejects the insert

#### Scenario: Composer is a word-wrapping text area

- **WHEN** an authenticated user types a message containing long content or
  explicit line breaks into the composer
- **THEN** the text wraps onto multiple lines within the composer rather than
  scrolling horizontally, and typing is never blocked

#### Scenario: Remaining count shown near the limit

- **WHEN** the draft length approaches the 200-character limit
- **THEN** the composer displays the number of characters remaining

#### Scenario: Over-limit characters marked and sending disabled

- **WHEN** the draft exceeds 200 characters
- **THEN** the user can keep typing, the characters beyond 200 are visually marked
  in red, the send control is disabled, and a message explains the input is over
  the limit

#### Scenario: Server rejects an over-length message

- **WHEN** a client posts a chat message whose trimmed body exceeds 200 characters
- **THEN** the posting action returns a user-facing error and does not insert the
  message, regardless of any client-side limit

### Requirement: Per-session chat scoping

The system SHALL scope live chat to a single broadcast session. Because each
broadcast is its own `streams` row and `chat_messages` reference a `stream_id`, a
newly started broadcast SHALL begin with an empty chat and SHALL never display
messages posted during a previous session of the same channel.

#### Scenario: New broadcast starts with empty chat

- **WHEN** a channel's previous broadcast ended with chat messages, and the
  channel goes live again as a new session
- **THEN** the live chat for the new session shows no messages from the previous
  session, starting empty until new messages are posted

#### Scenario: Messages are read for the current session only

- **WHEN** a viewer opens a channel that is live
- **THEN** the chat read and the real-time subscription are filtered to the
  current session's `stream_id`, so only that session's messages are shown

### Requirement: Horizontal-overflow-safe message rendering

The system SHALL render live chat message bodies so that no message, including one
containing a single unbroken token longer than the chat container's width (such as
a pasted URL), causes the chat window to scroll horizontally. Long words SHALL be
broken so that all message content wraps within the container's width.

#### Scenario: Long unbroken word wraps

- **WHEN** a chat message containing a single word longer than the chat
  container's width is displayed
- **THEN** the word is broken across lines and the chat window does not scroll
  horizontally

### Requirement: Chat in the scheduled waiting room

The system SHALL make chat read and post available for a public pre-live broadcast
(a dated `scheduled` broadcast or its `preview`) when `waiting_room_chat` is on, not
only for `live`. Read SHALL be public; posting SHALL require authentication, with RLS
permitting inserts to a public pre-live stream only when `waiting_room_chat` is true.
Waiting-room chat SHALL be scoped to the same stream id as the eventual live show, so
messages posted during the wait persist into the live broadcast.

#### Scenario: Authenticated viewer posts in the waiting room

- **WHEN** an authenticated viewer posts in the waiting room of a dated `scheduled`
  broadcast with `waiting_room_chat = true`
- **THEN** the message is inserted for that stream id and appears for all viewers in
  real time, and remains visible when the broadcast goes live

#### Scenario: Posting blocked when waiting-room chat is off

- **WHEN** a viewer attempts to post to a `scheduled`/`preview` stream with
  `waiting_room_chat = false` (or a private stream)
- **THEN** row-level security rejects the insert

#### Scenario: Anonymous viewer reads but cannot post

- **WHEN** an anonymous viewer opens the waiting room with chat enabled
- **THEN** they see messages in real time and the composer is replaced by a sign-in
  prompt

