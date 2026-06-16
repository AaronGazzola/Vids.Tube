## MODIFIED Requirements

### Requirement: Authenticated chat posting

The system SHALL allow only authenticated users to post chat messages, persisted
to `chat_messages` with the author's user id, and SHALL surface a sign-in prompt
to anonymous viewers in place of the composer. The system SHALL limit a chat
message to a maximum of 200 characters (matching YouTube). The composer SHALL
prevent entering more than 200 characters, and the server posting action SHALL
reject a message whose trimmed body exceeds 200 characters with a clear,
user-facing expected error, independent of the client.

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

#### Scenario: Composer caps input at 200 characters

- **WHEN** an authenticated user types into the chat composer
- **THEN** the input does not accept more than 200 characters

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
