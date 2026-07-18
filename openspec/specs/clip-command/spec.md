# clip-command Specification

## Purpose

Let viewers mark shortlist-worthy moments with !clip: a stream-time marker
with transcript context, an on-chat ack, and an owner shortlist panel that
survives the end of the stream.

## Requirements

### Requirement: Timestamped clip markers

The system SHALL record a `!clip` invocation as a marker carrying the stream
time (seconds since go-live, falling back to encoder start pre-live), the
requester's identity and origin, and a snippet of the most recent transcript
for context, and SHALL ack in chat that the clip was recorded and may be used
to make a YouTube short.

#### Scenario: Marker recorded with context

- **WHEN** a viewer sends `!clip` while the stream has transcript
- **THEN** a marker row stores the current stream time and the recent
  transcript snippet, and the viewer is told the clip was recorded and may
  become a YouTube short

#### Scenario: Marker without transcript

- **WHEN** `!clip` runs before any transcript exists
- **THEN** the marker is still recorded with an empty snippet and the ack still
  sends

### Requirement: Owner clip shortlist

During a stream, the system SHALL mark clip requests inline in the Activity
chat: the `!clip` message renders with emerald accenting and the marker's
formatted stream timestamp, with no live panel. When no stream is active, the
system SHALL list clip markers (formatted timestamp, requester, snippet) for
the channel's most recent ended stream in an Activity panel, so the shortlist
survives the end of the show.

#### Scenario: Clip request styled in chat

- **WHEN** a viewer's `!clip` creates a marker during a stream
- **THEN** that chat message renders with emerald accenting and the marker's
  stream timestamp

#### Scenario: Shortlist after the stream

- **WHEN** the owner opens the Activity tab after ending a stream that has
  markers
- **THEN** the clip markers panel lists that stream's markers with timestamps,
  requesters, and snippets
