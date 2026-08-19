## ADDED Requirements

### Requirement: A broadcast carries a task list

The system SHALL let the owner of a channel keep an ordered list of tasks against a broadcast. Each task
SHALL carry wording, a stable identifier, and exactly one of four statuses: `backlog`, `todo`,
`in_progress`, `completed`. The statuses SHALL carry no vocabulary specific to software, so a list of
recipe steps or workout sets uses the same four.

A task list SHALL belong to one broadcast. A task saved against one broadcast SHALL NOT appear on
another broadcast unless it is copied there deliberately.

#### Scenario: Tasks are kept per broadcast

- **WHEN** the owner saves a task list during one broadcast and later starts another broadcast
- **THEN** the second broadcast starts with an empty task list, and the first broadcast keeps the list
  that was saved against it

#### Scenario: A task identifier survives a save

- **WHEN** a task is added, saved, edited and saved again
- **THEN** the task keeps the identifier it was given when it was added

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

The system SHALL restrict reading and writing a broadcast's task versions to the owner of the channel
that broadcast belongs to. A signed-out visitor and a signed-in visitor who does not own the channel
SHALL be able to read nothing.

#### Scenario: A visitor cannot read the list

- **WHEN** a signed-out visitor or a signed-in visitor who does not own the channel queries the saved
  task versions
- **THEN** no rows are returned

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
time it is used, in the order `backlog`, `todo`, `in_progress`, `completed`, and back to `backlog` from
`completed`. The control SHALL show the task's current status, and SHALL carry an accessible label
naming that status.

#### Scenario: Cycling reaches every status

- **WHEN** the status control of a task in `backlog` is used four times
- **THEN** the task passes through `todo`, `in_progress` and `completed`, and returns to `backlog`

### Requirement: Tasks are reordered by dragging

The system SHALL let the owner reorder tasks by dragging a handle at the left of a task row. The order
after a drag SHALL be the order that is saved.

#### Scenario: Dragging changes the saved order

- **WHEN** the owner drags the last task's handle above the first task and saves
- **THEN** the saved list holds that task first

### Requirement: Unfinished tasks can be carried from the previous broadcast

The system SHALL offer, in the Settings tab, a control that fills the draft with the tasks whose status
is not `completed` from the newest saved version of the channel's most recent earlier broadcast. Each
carried task SHALL be added as a new task with a new identifier.

The control SHALL change the draft only, so nothing is recorded until the tab is saved. When there is no
earlier broadcast, or the earlier broadcast has no unfinished tasks, the system SHALL say so rather than
appearing to do nothing.

Reusing a previous broadcast's settings SHALL NOT copy that broadcast's tasks.

#### Scenario: Unfinished work is carried forward

- **WHEN** the owner uses the carry control on a broadcast whose predecessor ended with two unfinished
  tasks and three completed ones
- **THEN** the draft gains the two unfinished tasks and none of the completed ones

#### Scenario: Nothing to carry

- **WHEN** the owner uses the carry control and the previous broadcast has no unfinished tasks
- **THEN** the draft is unchanged and the absence is stated

#### Scenario: Reusing settings leaves tasks alone

- **WHEN** the owner reuses a previous broadcast's settings
- **THEN** the task draft is unchanged
