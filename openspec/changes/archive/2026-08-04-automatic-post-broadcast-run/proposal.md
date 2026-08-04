## Why

A broadcast only becomes complete community data after five separate steps: save its YouTube chat log, add whatever the live poller missed, score the chat, rebuild the memberships that follow, and record what went wrong. Every one of those is a script somebody has to remember to run.

Nobody remembered. The 4-Jul-2026 broadcast sat 23 messages short for a month because the log was never saved and compared. The 19-Jul-2026 broadcast was 19 short. 164 of 168 broadcasts went unscored until this cycle. None of that was a bug in any of the steps; each worked when run. They were simply never run.

Community features are about to read these numbers continuously. A pipeline that depends on somebody remembering five commands will drift again, and the drift will only surface when a chatter's standing is already wrong.

## What Changes

- The five steps become one pass, run per broadcast, in a fixed order that respects their dependencies.
- The worker runs the pass when a broadcast it was engaged with ends.
- The pass also catches up: any ended broadcast with no completion record is processed the next time the worker runs, so a broadcast that ended while the worker was offline is not skipped forever.
- Each broadcast records that the pass ran, what each step did, and what failed, so a second run is a no-op and a failed step is visible rather than silent.
- A step that fails does not stop the ones after it, unless a later step depends on it.

## Capabilities

### New Capabilities

- `post-broadcast-pass`: the ordered, resumable, self-recording pass that turns a finished broadcast into complete community data.

## Impact

- Worker: a new job, invoked when engagement ends and on catch-up.
- Database: a record per broadcast of what the pass did.
- Scripts: the existing five steps are called rather than duplicated, so a fix in one is a fix everywhere.
- Feeds the Studio health panel (AZ-215), which reports what this pass records.
