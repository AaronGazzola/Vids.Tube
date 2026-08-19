## MODIFIED Requirements

### Requirement: The reveal opens on the previous state and applies every change at once

The reveal SHALL first draw the list as it stood in the state the overlay last showed, then apply every
difference between that state and the new state at the same moment, then hold the new state before
fading.

The differences SHALL be worked out by the overlay by comparing the two saved versions, matched by task
identifier so that edited wording is not shown as a task being removed and another added. The
differences SHALL be shown as: a tick drawn into an empty box for a task that became completed, a cross
drawn into an empty box for a task that became canceled, struck-through wording for a canceled task, a
task appearing for one that was added, a task disappearing for one that was removed, and a status change
shown in place for any other move between statuses.

A completed task's wording SHALL NOT be struck through. The tick is what marks it done.

Differences SHALL NOT be animated one after another.

#### Scenario: Two changes animate together

- **WHEN** a save completes one task and moves another from backlog to todo
- **THEN** the reveal opens with both tasks in their previous states, and both changes are applied at the
  same moment

#### Scenario: Rewording is not a removal

- **WHEN** a save changes only the wording of a task
- **THEN** the task is not shown as removed and added, and its status is shown unchanged

#### Scenario: The first list of a broadcast

- **WHEN** the first version of a broadcast's task list is saved
- **THEN** every task in it is revealed as added

#### Scenario: A canceled task is crossed out

- **WHEN** a save cancels one task and completes another
- **THEN** the canceled task is drawn with a cross and struck-through wording, and the completed task is
  drawn with a tick and wording that is not struck through
