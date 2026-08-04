# chat-scoring-backfill Specification

## Purpose
TBD - created by archiving change score-chat-history. Update Purpose after archive.
## Requirements
### Requirement: Stored chat is scored a broadcast at a time

The system SHALL provide a pass that scores the stored chat of one broadcast, batching messages within it and giving the model the broadcast's transcript around each batch as context, producing a 0-100 rating on each configured criterion for every scored message. The pass SHALL accept a single broadcast or the whole history, and SHALL refuse a broadcast that has no transcript.

#### Scenario: One broadcast is scored

- **WHEN** the pass runs for a broadcast holding stored chat and a transcript
- **THEN** every eligible message in that broadcast has a rating, and no other broadcast is touched

#### Scenario: A broadcast without a transcript is refused

- **WHEN** the pass runs for a broadcast with no transcript
- **THEN** the pass reports the refusal and writes nothing for that broadcast

#### Scenario: A broadcast with no chat is skipped

- **WHEN** the pass runs for a broadcast whose chat is recorded as absent
- **THEN** the pass reports it as skipped and writes nothing

### Requirement: The backfill writes the same records the live path writes

The pass SHALL write `score_events` and `viewer_scores` rows of the same shape the live scorer writes, and SHALL then call `recompute_membership` for each affected participant. It SHALL NOT write memberships, experience, level or credits directly.

#### Scenario: Standing follows from the ratings

- **WHEN** a broadcast is scored for the first time
- **THEN** each participant's membership shows experience, level and credits derived from the new ratings, without the pass writing those values itself

#### Scenario: Live and backfilled standing agree

- **WHEN** a membership scored by the backfill is recomputed again with no new ratings between
- **THEN** every derived column holds the same value

### Requirement: Re-running a broadcast replaces its ratings

Running the pass again for a broadcast and a configuration version SHALL delete that broadcast's ratings and per-broadcast scores for that version before writing new ones, so a partial or repeated run cannot double-count a message.

#### Scenario: A repeated run does not double-count

- **WHEN** the pass runs twice for the same broadcast with the same configuration
- **THEN** each participant's experience for that broadcast after the second run equals what it was after the first

#### Scenario: A partial run can simply be repeated

- **WHEN** a run fails part-way through a broadcast and the pass is run again for it
- **THEN** the broadcast ends with one rating per eligible message

### Requirement: Bots and the host are never scored

The pass SHALL exclude messages whose origin is bot, and messages belonging to the community's host, matching the live path.

#### Scenario: Bot messages produce no ratings

- **WHEN** a broadcast containing bot messages is scored
- **THEN** no rating exists for any bot message

#### Scenario: The host earns nothing from their own broadcast

- **WHEN** a broadcast containing the host's own messages is scored
- **THEN** no rating and no per-broadcast score exists for the host

### Requirement: The backfill does not moderate

The pass SHALL request ratings only, and SHALL NOT hide, flag or ban on the basis of historical messages.

#### Scenario: No historical message is hidden

- **WHEN** the whole history is scored
- **THEN** no message's hidden state changes and no moderation record is created

### Requirement: The pass reports what it changed

The pass SHALL report, per run: broadcasts scored, skipped and refused; messages rated; and how many memberships changed standing as a result. It SHALL support a dry run that writes nothing.

#### Scenario: A dry run writes nothing

- **WHEN** the pass runs in dry-run mode
- **THEN** it reports what it would score and no rating, score or membership changes

#### Scenario: A surprising result is visible

- **WHEN** a run changes the standing of every membership
- **THEN** the report states how many memberships changed

