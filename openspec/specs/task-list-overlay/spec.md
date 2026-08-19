# task-list-overlay Specification

## Purpose

The broadcast overlay shows the task list as a passing reveal when the list changes or when the owner
asks for it, animating what changed rather than holding the list on screen.

## Requirements

### Requirement: The task list is revealed briefly, not held on screen

The overlay SHALL show a broadcast's task list as a passing reveal: the list enters, the changes are
applied, the new state is held for a moment, and the list fades out. The overlay SHALL NOT keep the task
list on screen between reveals.

#### Scenario: A reveal ends by itself

- **WHEN** a reveal is triggered
- **THEN** the list is drawn, the changes are shown, the list is held briefly and then fades out, with no
  further action by the owner

### Requirement: A save that changes the list triggers a reveal

The overlay SHALL reveal the task list when a new saved version of that broadcast's list appears. A save
that records no version, which is a save whose list is identical to the newest version, SHALL trigger no
reveal.

#### Scenario: Marking a task complete reveals the list

- **WHEN** the owner marks a task complete and saves
- **THEN** the overlay reveals the list

#### Scenario: Saving nothing reveals nothing

- **WHEN** the owner presses Save without having changed the list
- **THEN** the overlay reveals nothing

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

### Requirement: Bursts of saves collapse into one reveal

The overlay SHALL animate from the state it last showed to the newest saved state. When more than one
version is recorded while a reveal is on screen or while the slot is busy, the overlay SHALL show one
further reveal covering all of them rather than one reveal per version.

#### Scenario: Two quick saves

- **WHEN** two saves are recorded while a reveal is on screen
- **THEN** one further reveal is shown, opening on the state last shown and ending on the newest state

### Requirement: A reload replays nothing

The overlay SHALL treat the newest version at the moment it loads as already shown. Reloading the OBS
browser source mid-broadcast SHALL NOT replay a reveal for a version recorded before the reload.

#### Scenario: Refreshing the browser source

- **WHEN** the OBS browser source is reloaded during a broadcast whose task list was saved earlier
- **THEN** no reveal is shown until the list is saved again or a reveal is requested

### Requirement: The reveal shares the single feed slot

The reveal SHALL be drawn through the same slot as the highlight card, spoken messages, questions and
welcomes, and SHALL take the slot only when the slot is free. A reveal SHALL NOT interrupt or overlap
anything already holding the slot, and SHALL be shown once the slot becomes free.

#### Scenario: A reveal waits for the slot

- **WHEN** the list is saved while a highlighted message is on screen
- **THEN** the highlighted message plays out untouched, and the reveal is shown afterwards

### Requirement: The reveal can be switched off

The reveal SHALL be switchable per channel from the Overlays tab, alongside the other elements that share
the feed slot. While it is off, no reveal SHALL be drawn, and saving the task list SHALL still work.

#### Scenario: Turned off

- **WHEN** the reveal is switched off and the owner saves the task list
- **THEN** nothing is drawn on the overlay, and the saved list is recorded as normal
