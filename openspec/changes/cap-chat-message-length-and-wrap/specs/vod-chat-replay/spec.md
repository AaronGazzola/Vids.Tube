## ADDED Requirements

### Requirement: Horizontal-overflow-safe replay message rendering

The system SHALL render VOD chat-replay message bodies so that no message,
including one containing a single unbroken token longer than the replay panel's
width (such as a pasted URL), causes the replay panel to scroll horizontally. Long
words SHALL be broken so that all message content wraps within the panel's width.

#### Scenario: Long unbroken word wraps in replay

- **WHEN** a replayed message containing a single word longer than the replay
  panel's width is displayed
- **THEN** the word is broken across lines and the replay panel does not scroll
  horizontally
