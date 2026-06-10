## MODIFIED Requirements

### Requirement: Public chat read

The system SHALL allow anyone, including anonymous viewers, to read a live
stream's chat messages in real time. Each message's author SHALL be presented as
the author's channel identity — the channel `@handle`, display name, and avatar
resolved from the channel whose `owner_user_id` equals the message's author
`user_id` — and SHALL link to that author's channel page. The system SHALL NOT
render a raw or truncated user id as the author.

#### Scenario: Anonymous viewer reads chat

- **WHEN** an anonymous viewer opens a live stream
- **THEN** they see existing chat messages and receive new messages in real time,
  each labelled with its author's channel handle, name, and avatar

#### Scenario: Realtime message resolves its author

- **WHEN** a new chat message arrives over the realtime subscription
- **THEN** it is displayed with its author's channel handle, name, and avatar,
  resolving the author from the loaded channel set or a lookup, without blocking
  the message from appearing

#### Scenario: Author has no resolvable channel

- **WHEN** a chat message's author `user_id` has no matching channel row
- **THEN** the message renders with a neutral placeholder identity (no raw user
  id, no error)
