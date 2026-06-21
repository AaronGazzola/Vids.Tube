## MODIFIED Requirements

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

## ADDED Requirements

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
