# memberships Specification (delta)

## ADDED Requirements

### Requirement: Every identity with chat history holds a membership

The system SHALL create a membership for any identity that authored at least one
`chat_messages` row in a community's streams, including identities whose entire
history arrived through the archive import and who have never chatted live. An
identity with history SHALL NOT render zero totals because its messages were
imported rather than captured live.

#### Scenario: Archive-only chatter

- **WHEN** membership is recomputed for an identity whose only messages came
  from the archive import
- **THEN** a membership row exists with that identity's real message count,
  attended streams and first/last seen

#### Scenario: Identity with no messages

- **WHEN** membership is recomputed for an identity with no `chat_messages` rows
  in the community
- **THEN** no membership row is created

#### Scenario: Import completes after channel creation

- **WHEN** an identity's messages are imported after its channel was created
- **THEN** re-running the recompute produces the full totals with no duplicate
  membership
