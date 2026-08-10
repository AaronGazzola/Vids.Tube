# recording-swap Specification

## Purpose
TBD - created by archiving change swap-recording-for-youtube-copy. Update Purpose after archive.
## Requirements
### Requirement: The broadcast survives the swap

Swapping the file behind a recording SHALL leave the broadcast row and
everything attached to it intact: chat messages, scoring, memberships, credits,
badges and greetings.

#### Scenario: A broadcast with live-captured data

- **WHEN** the file behind a recording is swapped
- **THEN** the broadcast's chat message count, transcript segment count,
  membership stats and credit entries are unchanged afterwards

#### Scenario: The destructive path is closed

- **WHEN** the older replacement command, which deletes a broadcast, is run
  against a broadcast holding live-captured chat
- **THEN** it refuses, naming what it would have destroyed

### Requirement: The offset is measured from content, not from timestamps

The offset between the old recording and the replacement SHALL be determined by
aligning the speech in the two files. Timestamps SHALL NOT be used to derive it,
because the broadcast's own timestamps disagree with each other by about 21
minutes.

#### Scenario: Measuring the offset

- **WHEN** the swap is prepared for a broadcast holding a transcript
- **THEN** the offset is computed by finding the lag at which the existing
  transcript best matches the replacement's transcript

#### Scenario: No transcript for the replacement

- **WHEN** no caption track can be obtained for the replacement
- **THEN** the command fails, naming the missing transcript as the reason
- **AND** no offset is guessed from timestamps

### Requirement: The measurement carries a confidence, and a weak one refuses

The alignment SHALL report how many segments agreed on the winning offset and by
what margin it beat the next-best candidate. A winner that does not beat the
runner-up by a clear margin SHALL be treated as a failure to measure.

#### Scenario: A confident match

- **WHEN** several hundred segments agree on one offset and the next-best
  candidate matches far fewer
- **THEN** the offset is reported as measured, with both counts shown

#### Scenario: An unconfident match

- **WHEN** the best candidate does not clearly beat the next-best
- **THEN** the command refuses and writes nothing

### Requirement: A single offset is proven to describe the difference

Per-segment residuals SHALL be recorded, and the command SHALL refuse when they
drift across the broadcast rather than remaining flat, because drift means
material was removed from the middle and no single offset can describe the
result.

#### Scenario: A clean trim

- **WHEN** residuals stay flat from the start of the broadcast to the end
- **THEN** the replacement is treated as a trim and a single offset is applied

#### Scenario: An interior cut

- **WHEN** residuals drift across the broadcast
- **THEN** the command refuses, reporting where the drift begins

### Requirement: Duration confirms the trim

The replacement's duration plus the measured offset SHALL account for the live
portion of the original, within a stated tolerance. A violation SHALL fail the
run rather than be reported as a warning.

#### Scenario: Durations agree

- **WHEN** the replacement's duration plus the offset accounts for the original
  live portion
- **THEN** the check passes

#### Scenario: Durations disagree

- **WHEN** they do not agree within tolerance
- **THEN** the run fails, showing both numbers

### Requirement: A dry run reports everything and writes nothing

The command SHALL default to writing nothing, and SHALL report the measured
offset, the confidence, the residual spread, the duration check, and the three
moments a person should check.

#### Scenario: Running without applying

- **WHEN** the command is run without the apply flag
- **THEN** the measurement and the check list are printed and nothing is written

### Requirement: Three moments are named for a human check

The dry run SHALL name three timestamps spread across the broadcast, each
pairing a chat message with what was being said at that moment, so the check is
a matter of looking rather than of calculating.

#### Scenario: The check list

- **WHEN** the dry run completes
- **THEN** three timestamps are printed, each with the chat message and the
  transcript text expected at that position in the replacement

### Requirement: Everything measured against the recording is re-anchored

Applying the swap SHALL shift every timing that refers to the recording:
transcript segments, timeline spans and timeline moments. Chat messages SHALL
NOT be rewritten, since they carry wall-clock times and are re-anchored by what
the replay measures from.

#### Scenario: Applying the swap

- **WHEN** the swap is applied with a measured offset
- **THEN** transcript segments, timeline spans and timeline moments are shifted
  by that offset
- **AND** chat message rows are unchanged

#### Scenario: Replay after the swap

- **WHEN** the swapped recording is played
- **THEN** each chat message appears against the moment it was sent

### Requirement: The change is reversible

A snapshot of every value about to be rewritten SHALL be written before any
change, and the command SHALL be able to restore from it.

#### Scenario: Undoing a swap

- **WHEN** the swap is undone from its snapshot
- **THEN** the recording, the transcript segments and the timeline rows return
  to their previous values

### Requirement: The recording stays withheld until it is confirmed

The swapped recording SHALL be private while it is being checked, and made
public only as a deliberate act after the check.

#### Scenario: Immediately after the swap

- **WHEN** the swap has been applied
- **THEN** the recording is private, reachable by the owner and by nobody else

#### Scenario: After the check passes

- **WHEN** the owner confirms the three moments
- **THEN** the recording is made public as a separate step

