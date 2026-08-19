# stream-tasks Specification

## Purpose

A broadcast carries a list of tasks the streamer is working through, managed by the channel owner
from the control room and saved as whole versions so the list can be replayed at any point in the
broadcast.

## Requirements

### Requirement: A broadcast carries a task list

The system SHALL let the owner of a channel keep an ordered list of tasks against a broadcast. Each task
SHALL carry wording, a stable identifier, and exactly one of five statuses: `backlog`, `todo`,
`in_progress`, `completed`, `canceled`. The statuses SHALL carry no vocabulary specific to software, so a
list of recipe steps or workout sets uses the same five.

A task list SHALL belong to one broadcast. A task saved against one broadcast SHALL NOT appear on
another broadcast unless it is copied there deliberately.

#### Scenario: Tasks are kept per broadcast

- **WHEN** the owner saves a task list during one broadcast and later starts another broadcast
- **THEN** the second broadcast starts with an empty task list, and the first broadcast keeps the list
  that was saved against it

#### Scenario: A task identifier survives a save

- **WHEN** a task is added, saved, edited and saved again
- **THEN** the task keeps the identifier it was given when it was added

#### Scenario: Work is dropped rather than finished

- **WHEN** the owner decides during a broadcast that a task will not be done
- **THEN** the task can be marked `canceled` and stays in the list, rather than being marked completed or
  removed

### Requirement: A save writes the whole list as a version

The system SHALL record a task list as whole saved versions against the broadcast, each stamped with the
time it was saved. A version SHALL NOT be edited or deleted once written; a correction SHALL be written
as another version. The current task list SHALL be the newest version of that broadcast.

A save whose list is identical to the newest version SHALL write no version.

#### Scenario: Editing writes a new version

- **WHEN** the owner changes one task's status and saves
- **THEN** a new version holding the whole list is recorded, and the previous version is left as it was

#### Scenario: Saving an unchanged list writes nothing

- **WHEN** the owner presses Save without having changed anything
- **THEN** no version is written and the current list is unchanged

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

### Requirement: Editing is a draft until saved

The system SHALL hold every edit to a task list as a draft. Typing wording, changing a status, adding a
task, removing a task and reordering tasks SHALL all change the draft alone. Nothing SHALL be recorded
against the broadcast until the owner saves.

The Settings tab and the Activity tab SHALL edit one draft, so an unsaved change made on one surface is
visible on the other.

The Settings tab draft SHALL be committed by the same Save changes press that commits the rest of that
tab. The Activity tab popover SHALL be committed by its own Save control, placed at the bottom right of
the popover.

A blank task SHALL NOT be saved.

#### Scenario: Nothing is recorded before saving

- **WHEN** the owner marks a task complete in the Activity tab popover and does not press Save
- **THEN** the saved list still holds that task as it was before

#### Scenario: One draft behind both surfaces

- **WHEN** the owner types a task in the Settings tab and opens the Activity tab popover without saving
- **THEN** the popover shows the typed task

#### Scenario: A blank task is discarded

- **WHEN** the owner saves a list whose last row has no wording
- **THEN** the saved list holds every filled task and not the blank one

### Requirement: The bottom of the list holds at most one empty row

The system SHALL keep at most one empty row at the bottom of a task list draft. When the last two rows
are both empty, the last SHALL be removed. An empty row elsewhere in the list SHALL be left alone.

The control that adds a task SHALL be hidden while the last row is empty, and shown when the last row
has wording or the list is empty.

#### Scenario: A second trailing blank row is removed

- **WHEN** the draft's last two rows are both empty
- **THEN** the last row is removed, leaving one empty row at the bottom

#### Scenario: The add control hides behind an empty row

- **WHEN** the last row of the draft is empty
- **THEN** no add control is shown, and it reappears once that row has wording

### Requirement: A task row is edited as wrapping text

The system SHALL render each task's wording as a text area one row tall, not a single-line input, so
wording longer than the row wraps into view instead of scrolling sideways.

#### Scenario: Long wording wraps

- **WHEN** a task's wording is longer than the width of its row
- **THEN** the wording wraps within the row rather than scrolling horizontally

### Requirement: A task status is changed by cycling

The system SHALL change a task's status through a single control that advances to the next status each
time it is used, in the order `backlog`, `todo`, `in_progress`, `completed`, `canceled`, and back to
`backlog` from `canceled`. The control SHALL show the task's current status, and SHALL carry an
accessible label naming that status.

A `canceled` task SHALL be shown with a cross and with its wording struck through. A `completed` task
SHALL be shown with a tick and SHALL NOT have its wording struck through.

#### Scenario: Cycling reaches every status

- **WHEN** the status control of a task in `backlog` is used five times
- **THEN** the task passes through `todo`, `in_progress`, `completed` and `canceled`, and returns to
  `backlog`

#### Scenario: Only canceled wording is struck through

- **WHEN** a list holds one completed task and one canceled task
- **THEN** the canceled task's wording is struck through and the completed task's wording is not

### Requirement: Tasks are reordered by dragging

The system SHALL let the owner reorder tasks by dragging a handle at the left of a task row. The order
after a drag SHALL be the order that is saved.

#### Scenario: Dragging changes the saved order

- **WHEN** the owner drags the last task's handle above the first task and saves
- **THEN** the saved list holds that task first

### Requirement: Unfinished tasks can be carried from the previous broadcast

The system SHALL offer, in the Settings tab, a control that fills the draft with the tasks that are
neither `completed` nor `canceled` from the newest saved version of the channel's most recent earlier
broadcast. Each carried task SHALL be added as a new task with a new identifier.

The control SHALL change the draft only, so nothing is recorded until the tab is saved. When there is no
earlier broadcast, or the earlier broadcast has no unfinished tasks, the system SHALL say so rather than
appearing to do nothing.

Reusing a previous broadcast's settings SHALL NOT copy that broadcast's tasks.

#### Scenario: Unfinished work is carried forward

- **WHEN** the owner uses the carry control on a broadcast whose predecessor ended with two unfinished
  tasks, three completed ones and one canceled one
- **THEN** the draft gains the two unfinished tasks and none of the others

#### Scenario: Nothing to carry

- **WHEN** the owner uses the carry control and the previous broadcast has no unfinished tasks
- **THEN** the draft is unchanged and the absence is stated

#### Scenario: Reusing settings leaves tasks alone

- **WHEN** the owner reuses a previous broadcast's settings
- **THEN** the task draft is unchanged

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
