## MODIFIED Requirements

### Requirement: Replay panel visibility

The system SHALL show the chat replay panel expanded by default when replay is
available, SHALL allow the viewer to collapse it to a compact re-expand control
and expand it again at will, SHALL give the video player the freed space while the
panel is collapsed, SHALL persist the collapsed/expanded preference across reloads
and navigations (defaulting to expanded), and SHALL render nothing when no replay
is available.

#### Scenario: Shown by default

- **WHEN** a VOD has a `source_stream_id` whose stream has at least one chat
  message
- **THEN** the chat replay panel is visible and expanded alongside the player
  without any viewer action

#### Scenario: Viewer collapses the panel

- **WHEN** the viewer collapses the replay panel
- **THEN** the message list is hidden, a compact re-expand control remains
  visible, and the video player expands to use the freed space

#### Scenario: Viewer re-expands the panel

- **WHEN** the viewer activates the re-expand control on a collapsed panel
- **THEN** the full replay panel is shown again, time-synced to the current
  playback position

#### Scenario: Collapsed preference persists

- **WHEN** the viewer collapses the panel and then reloads or navigates to
  another VOD that has replay
- **THEN** the panel starts collapsed, reflecting the saved preference

#### Scenario: No replay available

- **WHEN** a VOD has no `source_stream_id`, or its source stream has no chat
  messages
- **THEN** no chat replay panel or re-expand control is rendered and the watch
  page lays out as if replay did not exist
