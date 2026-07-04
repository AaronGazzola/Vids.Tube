## ADDED Requirements

### Requirement: Owner can hide a chat message

The owner SHALL be able to hide a chat message. A hidden message SHALL be removed from the
public live chat, excluded from scoring, and any existing feature of it SHALL be retracted.
The owner SHALL be able to unhide it.

#### Scenario: Hiding removes a message everywhere

- **WHEN** the owner hides a message
- **THEN** it no longer appears in the public chat, is not scored, and is not featured

#### Scenario: Unhiding restores it

- **WHEN** the owner unhides a previously hidden message
- **THEN** it is readable in the chat again

### Requirement: Owner can ban a participant

The owner SHALL be able to ban a participant (Vids.Tube user or YouTube author). A ban
SHALL persist across the owner's streams, SHALL prevent a banned Vids.Tube user from
posting, and SHALL stop the bot scoring/featuring the banned participant. YouTube bans are
hide-from-our-side only (no YouTube API enforcement). The owner SHALL be able to unban.

#### Scenario: A banned user cannot post

- **WHEN** a banned Vids.Tube user tries to post a chat message
- **THEN** the insert is rejected by row-level security

#### Scenario: A banned participant is not scored

- **WHEN** the scoring bot processes a batch containing a banned participant's message
- **THEN** that message is skipped and earns no score and no feature

### Requirement: AI modbot with manual/auto modes

The system SHALL let the AI recommend moderation actions, governed by a per-stream
`moderation_mode` of `manual` (default) or `auto`. In manual mode the modbot SHALL only
record suggestions with reasons for the owner to approve or dismiss. In auto mode the
modbot SHALL apply its recommended actions and record them with their reasons. Every
suggestion and action SHALL be auditable.

#### Scenario: Manual mode suggests only

- **WHEN** the modbot flags a message while `moderation_mode` is `manual`
- **THEN** a suggestion is recorded for the owner and nothing is hidden or banned until the
  owner approves it

#### Scenario: Auto mode applies and logs

- **WHEN** the modbot flags a message while `moderation_mode` is `auto`
- **THEN** the action is applied and recorded with its reason in the moderation log

#### Scenario: Owner switches modes

- **WHEN** the owner switches between manual and auto in the Control Room
- **THEN** subsequent modbot behavior follows the selected mode
