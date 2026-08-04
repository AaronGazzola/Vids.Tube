# host-participation Specification

## Purpose
TBD - created by archiving change host-participant-class. Update Purpose after archive.
## Requirements
### Requirement: Host detection from the broadcast channel id

The system SHALL treat a YouTube chat message as a host message when its author
channel id equals the YouTube channel id of the broadcast it arrived on,
resolved as `streams.youtube_channel_id` when set and otherwise as the
`channels.youtube_channel_id` of the stream's community channel. Detection SHALL
require no OAuth, no per-channel configuration, and no verified
`youtube_links` row.

#### Scenario: Live stream with a configured YouTube URL

- **WHEN** a YouTube chat message arrives whose author channel id equals the
  stream's `youtube_channel_id`
- **THEN** the message is treated as a host message

#### Scenario: Historical stream with no stream-level id

- **WHEN** a message belongs to a stream whose `youtube_channel_id` is null and
  its author channel id equals the community channel's `youtube_channel_id`
- **THEN** the message is treated as a host message

#### Scenario: Ordinary chatter is not a host

- **WHEN** a YouTube chat message arrives from any other author channel id
- **THEN** the message is treated as an ordinary viewer message

### Requirement: Host detection never verifies a YouTube link

The system SHALL NOT write `youtube_links.verified_at`, create a
`youtube_links` row, or trigger `merge_youtube_identity` as a result of host
detection. Verification SHALL remain exclusively the chat-code path.

#### Scenario: Host detected with no verified link

- **WHEN** host messages are detected on a stream whose owner has no verified
  `youtube_links` row
- **THEN** host suppression applies and no link row is created or verified

#### Scenario: Wrong URL pasted

- **WHEN** a streamer configures a broadcast URL belonging to a YouTube channel
  they do not control
- **THEN** the effect is confined to host suppression within that community, and
  no identity is merged and no history is moved

### Requirement: Host messages are attributed to the channel owner at ingest

The system SHALL insert host messages into `chat_messages` with `user_id` set to
the community channel's `owner_user_id`, retaining `origin` `youtube` and the
author's `external_author_id`.

#### Scenario: Host message is attributed

- **WHEN** the worker ingests a host message on a stream whose channel has an
  owner
- **THEN** the stored row carries that owner's `user_id` alongside the original
  YouTube author id

#### Scenario: Ownerless community

- **WHEN** the stream's community channel has no `owner_user_id`
- **THEN** the message is stored unattributed and host suppression still applies

### Requirement: Host messages are excluded from scoring

The system SHALL NOT buffer host messages for scoring, and SHALL NOT produce
`score_events`, `viewer_scores`, `featured_messages`, XP, level, or streak
values from them.

#### Scenario: Host chats during a stream

- **WHEN** the host sends messages in their own stream
- **THEN** no scoring rows are written for those messages and the host appears
  in no rank for that stream

### Requirement: Host messages retain command execution

The system SHALL continue to dispatch commands from host messages, with the
host's existing elevated permissions, unlike bot messages which are excluded
from command dispatch.

#### Scenario: Host runs a command from YouTube chat

- **WHEN** the host sends `!clip` or `!break` in their own YouTube chat
- **THEN** the command executes normally

### Requirement: No chatter channel is created for a host or a claimed identity

The unclaimed-channel creation job SHALL skip any author channel id that is held
by a channel with a non-null `owner_user_id`, and any author channel id equal to
a community channel's `youtube_channel_id`. The job SHALL log each skip with its
reason.

#### Scenario: Host id is skipped

- **WHEN** the job encounters the community's own YouTube channel id
- **THEN** no channel is created for it and the skip is logged

#### Scenario: Already claimed id is skipped

- **WHEN** the job encounters an author channel id already held by an owned
  channel
- **THEN** no duplicate channel is created

### Requirement: Host suppression is scoped to the community they host

The system SHALL apply host suppression only within communities whose stream
carries that YouTube channel id. A channel that hosts one community SHALL remain
an ordinary scored member with a membership in every other community.

#### Scenario: Streamer chats in another streamer's community

- **WHEN** a channel that hosts community A sends messages in community B's
  stream
- **THEN** those messages are scored and counted toward their membership in
  community B

### Requirement: Database rejects a duplicate identity for a community id

The database SHALL reject creation of a channel with `owner_user_id` null whose
`youtube_channel_id` equals the `youtube_channel_id` of any channel that owns
streams, so a script that ignores the job-level skip fails loudly.

#### Scenario: Script bypasses the job skip

- **WHEN** an insert attempts to create an ownerless channel for a community's
  YouTube channel id
- **THEN** the database rejects the insert with a clear error

