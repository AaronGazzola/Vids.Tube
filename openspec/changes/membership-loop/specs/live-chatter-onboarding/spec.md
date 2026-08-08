## MODIFIED Requirements

### Requirement: An unknown chatter is onboarded on their first message

When a chat message arrives during a broadcast from a YouTube account that has no channel and no retired profile pointing at one, the worker SHALL create a channel for that account. On every chatter's first message of a broadcast — whether or not their channel already existed — the worker SHALL call `recompute_membership` for the resolved channel and the broadcast's community, before the message reaches the scoring buffer. Onboarding SHALL happen at most once per account per broadcast.

Computing the membership on every first message, rather than only when the channel is created, is what guarantees a membership exists in *this* community for a chatter who already has a channel from some other community. Without it, that membership would only appear later, from the scoring step, and only when the scoring call succeeds.

#### Scenario: First-time chatter gets a channel and a membership

- **WHEN** an account with no existing channel sends its first message during a broadcast
- **THEN** a channel exists for that account and a membership exists for that channel in the broadcast's community

#### Scenario: A returning chatter is not onboarded again

- **WHEN** an account that already has a channel sends a message
- **THEN** no new channel is created and the existing channel is used

#### Scenario: An existing channel joins a second community

- **WHEN** a chatter who already has a channel from another community sends their first message in this broadcast
- **THEN** a membership for that channel in this broadcast's community exists once the message has been ingested, without waiting for the scoring step

#### Scenario: The membership is present before the greeting

- **WHEN** the greeting for a chatter's first message of a broadcast is composed
- **THEN** that chatter's membership in the broadcast's community already exists and can be read

#### Scenario: A retired profile is not re-created

- **WHEN** an account whose channel has been retired into another channel sends a message
- **THEN** no new channel is created and the surviving channel is used

#### Scenario: Onboarding precedes scoring

- **WHEN** a first-time chatter's message is scored in the batch it arrived in
- **THEN** the membership already exists and receives that batch's XP

#### Scenario: Recomputing twice is harmless

- **WHEN** the membership is recomputed on the first message and again by the scoring step
- **THEN** the stored totals are identical, because the recompute rebuilds from raw events rather than incrementing
