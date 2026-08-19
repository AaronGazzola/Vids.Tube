## MODIFIED Requirements

### Requirement: Only the channel owner can read or write the list

The system SHALL restrict writing a broadcast's task versions to the owner of the channel that broadcast
belongs to. No visitor SHALL be able to write a task version under any circumstance.

Reading SHALL be permitted to the owner at all times, and to anyone while the broadcast is live, because
the overlay reads the list without the service role key. Once the broadcast is no longer live, the task
versions SHALL stop being readable by anyone but the owner.

#### Scenario: A visitor cannot read a broadcast that is not live

- **WHEN** a signed-out visitor, or a signed-in visitor who does not own the channel, queries the task
  versions of a broadcast that is not live
- **THEN** no rows are returned

#### Scenario: The overlay reads a live broadcast

- **WHEN** the task versions of a live broadcast are queried without the service role key
- **THEN** the versions of that broadcast are returned

#### Scenario: A visitor cannot write

- **WHEN** a visitor who does not own the channel attempts to write a task version
- **THEN** the write is refused

## ADDED Requirements

### Requirement: The saved list can be shown on demand

The system SHALL offer a control at the bottom left of the Activity tab task popover that shows the saved
task list on the overlay without changing it. The control SHALL record a reveal request carrying the
newest saved list, so the audience is shown what is saved and never an unsaved draft.

The control SHALL be unavailable while the draft differs from the saved list, and the reason SHALL be
stated. The control SHALL record nothing when the broadcast has no saved list, and SHALL say that there
is nothing to show.

#### Scenario: Showing the list unchanged

- **WHEN** the owner uses the show-in-overlay control with no unsaved edits
- **THEN** the overlay draws the saved list with nothing animated, holds it, and fades it out

#### Scenario: Unsaved edits block the control

- **WHEN** the owner has edited the draft without saving
- **THEN** the show-in-overlay control is unavailable and the need to save first is stated

#### Scenario: Nothing saved yet

- **WHEN** the owner uses the show-in-overlay control on a broadcast with no saved task list
- **THEN** nothing is recorded and the absence is stated
