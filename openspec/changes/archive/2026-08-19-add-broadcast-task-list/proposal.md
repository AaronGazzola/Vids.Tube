## Why

The channel streams development work, and the audience has no way of seeing what is being worked on,
what is finished, and what is left. AZ-268 asks for a task list carried by a broadcast, managed by the
owner and shown to viewers.

Two scoping decisions were settled with the owner before writing this, because both change the data
model:

**The list belongs to a broadcast, not to a channel.** Under channel scope an item completed on one
broadcast still reads as completed at the start of the next one, so a clearing step would be needed
every broadcast anyway, and an item created during a later broadcast would have to be hidden from an
earlier recording. Broadcast scope gives both for free, at the cost of carrying unfinished items forward
by hand. That carry is an explicit button, and it deliberately copies nothing else: reusing a previous
broadcast's settings must not drag its task list along.

**A save writes the whole list, not one item.** Every surface here edits a draft and commits it with one
press, so no item is ever written on its own. Storing each save as a whole version makes the history the
recording needs fall out of the same rows: the list on a recording is the newest version at or before the
playback position. The overlay reveal in the following change gets its before-and-after from the same
two rows. A per-item table plus a status-history table would need a trigger to keep the two consistent
and a join to answer the same question.

## What Changes

- A broadcast carries an ordered list of tasks, each with wording and one of four statuses: backlog,
  todo, in progress, completed.
- Nothing in the wording is specific to software, so a streamer tracking recipe steps or workout sets
  uses the same four statuses.
- Each save writes the whole list as one version against the broadcast. Versions are never edited or
  deleted; a correction is another version.
- The Settings tab of `/live` gains a tasks section, saved by the Save changes button that already
  commits the rest of that tab.
- The Settings tab gains a button that fills the draft with the unfinished tasks from the channel's
  previous broadcast. The button writes nothing on its own.
- The Activity tab gains a checkbox icon button opening a popover holding the same list, with its own
  Save button.
- A row is a one-row text area rather than a single-line input, so wrapped wording stays readable.
- A row's status is changed by a button that cycles the four statuses and shows the current one.
- Rows are reordered by dragging a handle on the left, using native browser drag events rather than a
  new package.
- The bottom of the list holds at most one empty row, and the add button hides while that row is empty.
- Both surfaces edit one draft, so a change typed in Settings is visible in the popover before either is
  saved.

## Capabilities

### Added Capabilities

- `stream-tasks`: a broadcast's task list, its saved versions, and the two owner surfaces that edit it.

## Impact

- One new table holding a saved version per press, owner-only under row-level security, append-only.
- The Settings tab and the Activity tab header of `/live` each gain a task surface backed by one shared
  draft store and one list editor.
- **Not in this change:** the overlay reveal (`add-task-list-overlay`), the viewer panel on the live page,
  the panel on a recording, the `!tasks` chat reply, and any interface for updating the list from outside
  Vids.Tube.
