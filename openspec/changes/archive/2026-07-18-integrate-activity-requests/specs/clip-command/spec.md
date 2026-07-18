## MODIFIED Requirements

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
