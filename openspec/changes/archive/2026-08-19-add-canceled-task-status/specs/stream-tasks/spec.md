## MODIFIED Requirements

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
