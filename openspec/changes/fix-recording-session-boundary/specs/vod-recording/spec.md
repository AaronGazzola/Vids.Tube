## ADDED Requirements

### Requirement: A recording's start time is read from its filename

The finalize step SHALL derive each recording segment's start time from the timestamp the recorder writes into the segment's filename, and SHALL NOT use filesystem timestamps for this purpose. A segment whose filename does not carry a parseable timestamp SHALL be skipped with a logged warning rather than assigned a substitute time.

#### Scenario: The start time is the start

- **WHEN** a segment named for the moment recording began is finalized
- **THEN** its session start is that moment, regardless of when the file was last written

#### Scenario: An unparseable name is skipped, not guessed

- **WHEN** a file in the recording directory does not carry a parseable timestamp
- **THEN** it is excluded from the recording and the exclusion is logged

### Requirement: The broadcast is identified from its newest segment

The finalize step SHALL request the broadcast's bounds using the start time of the newest segment present, because that segment always belongs to the session being finalized.

#### Scenario: Debris does not select the broadcast

- **WHEN** the recording directory holds segments from an earlier broadcast alongside the current one
- **THEN** the bounds requested are those of the current broadcast

### Requirement: Only the current broadcast's segments are included

The finalize step SHALL include only segments whose start time is at or after the broadcast's own start, allowing a small tolerance for the recorder beginning to write moments before the encoder connection is recorded. Segments starting before that boundary SHALL be excluded from the recording.

#### Scenario: An earlier broadcast is not absorbed

- **WHEN** segments from a previous broadcast remain in the directory
- **THEN** the published recording contains only the current broadcast's footage

#### Scenario: The broadcast's own first segment is kept

- **WHEN** the recorder began writing moments before the encoder connection was recorded
- **THEN** that segment is treated as part of the broadcast rather than as debris

### Requirement: Pre-live footage is excluded from the recording

The finalize step SHALL trim the recording so it begins at the moment the broadcast went public, computed as the difference between that moment and the first included segment's start.

#### Scenario: The recording starts at go-live

- **WHEN** a broadcast recorded 15 minutes before going public is finalized
- **THEN** the published recording begins at the moment it went public

#### Scenario: A broadcast that never went public produces no recording

- **WHEN** a broadcast has no go-live moment
- **THEN** no recording is published

### Requirement: Segments from an earlier broadcast are deleted on every finalize

The finalize step SHALL delete segments identified as belonging to an earlier broadcast, whether or not that broadcast was ever marked ended, and SHALL do so only after the current broadcast's recording has been built successfully. The current broadcast's own segments SHALL continue to be kept until it is marked ended, so a reconnect can re-finalize.

#### Scenario: An unended broadcast cannot poison the next one

- **WHEN** a broadcast is never marked ended and a later broadcast is finalized
- **THEN** the earlier broadcast's segments are deleted during that finalize

#### Scenario: A failure removes nothing

- **WHEN** the recording cannot be built
- **THEN** no segment is deleted

#### Scenario: A reconnect can still re-finalize

- **WHEN** a broadcast that has not ended is finalized and then reconnects
- **THEN** its own earlier segments are still present and are included in the next finalize

### Requirement: The finalized recording is removed from the machine after upload

The finalize step SHALL delete the concatenated recording and its poster image from local disk once both the upload and the app notification have succeeded, because they exist only to be uploaded.

#### Scenario: Local copies do not accumulate

- **WHEN** a recording is uploaded and the app is notified
- **THEN** the local recording and poster are removed

#### Scenario: A failed upload keeps the local copy

- **WHEN** the upload or the notification fails
- **THEN** the local recording is left in place

### Requirement: The finalized recording is removed from the machine after upload

The finalize step SHALL delete the concatenated recording and its poster image from local disk once both the upload and the app notification have succeeded, because they exist only to be uploaded.

#### Scenario: Local copies do not accumulate

- **WHEN** a recording is uploaded and the app is notified
- **THEN** the local recording and poster are removed

#### Scenario: A failed upload keeps the local copy

- **WHEN** the upload or the notification fails
- **THEN** the local recording is left in place
