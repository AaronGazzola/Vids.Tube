## Why

`add-broadcast-task-list` gives a broadcast a task list and two owner surfaces for editing it, but the
audience still cannot see it. This change puts the list on the overlay.

The owner's rule is that the list is not a permanent fixture on screen. It appears for a few seconds when
something about it changes, shows what changed, and gets out of the way. The moment worth watching is the
change itself: a box being ticked, a line being struck out, a task appearing, a task moving out of the
backlog. So the reveal opens on the list as it stood before the save, applies every change at once, holds
the new state briefly, and fades.

Saving a version already records the whole list, so the two most recent versions are the before and the
after. No separate record of "what changed" is stored, and no animation instructions are sent to the
overlay: the overlay works out the differences from the two versions it can already read.

## What Changes

- The overlay shows the task list briefly and then fades out, rather than holding the screen.
- A reveal is triggered by a save that changed the list. A save that changed nothing writes no version and
  therefore reveals nothing.
- A reveal is also triggered by a show-in-overlay button at the bottom left of the Activity tab popover,
  which shows the saved list with nothing animated. The button sends the saved list, so an unsaved draft
  never reaches the audience.
- The reveal draws the previous state first, then applies every difference at the same moment: a
  checkmark appearing, a line being struck out, a task appearing, a task changing status.
- Bursts collapse: the overlay animates from the state it last showed to the newest saved state, so two
  saves in quick succession produce one reveal covering both.
- Reloading the OBS browser source mid-broadcast replays nothing, matching how the welcome card ignores
  arrivals from before it loaded.
- The reveal shares the single feed slot with the highlight card, spoken messages, questions and
  welcomes, so it waits its turn rather than overlapping them.
- The reveal can be switched off per channel from the Overlays tab, alongside the other things that share
  that slot.
- The task versions of a live broadcast become readable while the broadcast is live, which is what lets
  the overlay read them without the service role key.

## Capabilities

### Added Capabilities

- `task-list-overlay`: the overlay reveal of a broadcast's task list, and what triggers it.

### Modified Capabilities

- `stream-tasks`: the show-in-overlay control, and read access to task versions while a broadcast is live.

## Impact

- One added policy making a live broadcast's task versions readable, and one added kind of version row
  that records a reveal request rather than a change.
- The overlay gains one card drawn through the existing shared slot, one visibility toggle, and a
  simulated version for the Overlays tab.
- **Not in this change:** the viewer panel on the live page, the panel on a recording, and the `!tasks`
  chat reply. AZ-268 has the `!tasks` reply showing the overlay list; that is superseded here, because a
  reveal is triggered by a save or by the button and by nothing else.
- **Depends on:** `add-broadcast-task-list`, which creates the table and the two editing surfaces. This
  change is built and archived after it.
