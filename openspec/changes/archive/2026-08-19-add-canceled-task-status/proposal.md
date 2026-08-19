## Why

The task list shipped with four statuses, and work that gets dropped mid-broadcast has nowhere to go.
Marking it completed is a lie, and deleting it hides that it was ever considered, which is exactly the
kind of thing the audience is watching for.

The strikethrough was also on the wrong status. A completed task reads as finished from its tick, and
striking it out makes the list look like a page of crossed-off failures. Struck-out text says abandoned,
so it belongs to the new status instead.

## What Changes

- A fifth status, canceled, is added after completed in the cycle, so pressing the status control once
  more on a completed task cancels it and pressing again returns it to the backlog.
- Canceled is drawn with a cross, in the editor and on the overlay.
- Canceled text is struck through, in the editor and on the overlay.
- Completed text is no longer struck through anywhere. The tick is what marks it done.
- Carrying unfinished tasks from the previous broadcast skips canceled tasks as well as completed ones.

## Capabilities

### Modified Capabilities

- `stream-tasks`: the fifth status, its place in the cycle, and its exclusion from the carry-over.
- `task-list-overlay`: what the reveal draws for a canceled task, and what it no longer draws for a
  completed one.

## Impact

- No migration. A status is a string inside the stored list, and no saved list holds the new one yet.
- **Not in this change:** any per-status behaviour beyond drawing, such as hiding canceled tasks from the
  reveal or counting them separately.
