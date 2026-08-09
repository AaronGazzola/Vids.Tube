## ADDED Requirements

### Requirement: Software identities are excluded from membership

The system SHALL mark a channel as software via a `channels.is_software` boolean, defaulting to false. A channel marked as software SHALL be excluded from every member count, every leaderboard, and every badge award, and SHALL NOT be shown as a member anywhere in the interface. Its chat history and its channel row SHALL remain intact, because the bot's own messages are part of the broadcast record.

The Nightbot account SHALL be marked as software, because every VidsBot line is delivered through it and is therefore stored under its identity.

#### Scenario: The delivery bot is not a member

- **WHEN** the member count, the leaderboard, or a badge award is computed for a community
- **THEN** the channel marked as software is absent from all three

#### Scenario: The bot's chat history survives the exclusion

- **WHEN** a channel is marked as software
- **THEN** its chat messages remain readable in chat history and in replay

#### Scenario: Ordinary chatters are unaffected

- **WHEN** a chatter whose display name merely contains the word "bot" sends a message
- **THEN** that chatter is onboarded and counted normally, because the marker is set per channel and never inferred from a name

### Requirement: Member count counts YouTube-backed memberships

The system SHALL define a community's member count as the number of memberships in that community whose member channel carries a YouTube identity and is not marked as software. Memberships whose channel has no YouTube identity SHALL be excluded from the count.

This definition SHALL hold across an identity merge without the count changing: before the merge the YouTube-backed channel is counted and the account-only channel is not; after the merge the surviving channel carries the YouTube identity and is counted, and the retired channel no longer holds a membership.

#### Scenario: Claiming an identity does not change the count

- **WHEN** a person who chatted both on YouTube and on the site verifies their YouTube link and the merge runs
- **THEN** the community's member count is the same before and after the merge

#### Scenario: An account-only membership is not counted

- **WHEN** a membership's channel has no YouTube identity
- **THEN** that membership is excluded from the member count

#### Scenario: The count excludes software

- **WHEN** the member count is computed for a community whose chat includes the delivery bot
- **THEN** the bot is not included in the total

### Requirement: Test channels are removed

The system SHALL remove the channels named `test` and `test4`, together with their memberships, because both were created during development and neither represents a person. Removal SHALL be performed by a script rather than by hand.

#### Scenario: Test channels no longer hold memberships

- **WHEN** the removal script has run
- **THEN** no membership exists for either test channel, and neither appears in a member count or on a leaderboard
