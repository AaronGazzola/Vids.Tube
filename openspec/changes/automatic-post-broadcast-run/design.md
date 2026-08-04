## Context

Five steps turn a finished broadcast into complete community data, and each already exists as a working script: save the YouTube chat log, top up messages the live poller missed, score the chat, rebuild the memberships that follow, and verify the credit ledger.

They have hard dependencies. Scoring reads chat, so the top-up must precede it. The top-up compares stored chat against the saved log, so saving must precede that. Memberships derive from ratings, so scoring must precede the rebuild. Only the ledger check is independent, and it is only meaningful after the rebuild.

The worker already engages a broadcast, holds a lock on it, and stops when the broadcast ends. That is where the pass belongs.

## Goals / Non-Goals

**Goals:**

- A finished broadcast becomes complete community data with no manual step.
- A broadcast that ended while the worker was offline is caught up rather than lost.
- Running the pass twice changes nothing the second time.
- A failed step is recorded and visible, not silent.

**Non-Goals:**

- Displaying any of this. The Studio health panel is AZ-215 and reads what this records.
- Changing what any of the five steps does. The pass orders and records them.
- Repairing a broadcast that fails repeatedly. The record makes the failure visible; deciding what to do about it is a person's job.

## Decisions

### The pass calls the existing steps rather than reimplementing them

Each step stays where it is and keeps its own command-line entry point. The pass imports and invokes them.

Duplicating the logic would mean two versions of "top up the chat", and the one the pass used would quietly drift from the one a person runs by hand. The scripts are already written to be idempotent and to take a single broadcast, which is exactly the shape the pass needs.

### Completion is recorded per broadcast, per step

A row per broadcast carries when the pass last ran and what each step reported: messages saved, messages added, ratings written, memberships rebuilt, and any error.

Recording only "done" would make a partly failed pass indistinguishable from a clean one, which is the mistake the scoring run already made once by reporting a broadcast as scored when every batch had failed.

### A failed step does not abort the pass, unless something downstream needs it

Saving the log and topping up are independent of each other in failure: if the log cannot be fetched, the top-up simply has nothing to add. Scoring depends on chat being present, and the membership rebuild depends on ratings, so a failure there stops what follows and says so.

### Catch-up is by absence of a record, not by a timestamp

The pass processes any ended broadcast that has no completion record, rather than anything newer than some watermark.

A watermark would skip a broadcast that ended out of order, which happens: the abandoned-broadcast sweep ends a broadcast hours after it actually stopped. Absence of a record cannot be fooled that way.

### The worker runs it, because the worker is what notices

The worker already knows when a broadcast ends, and already holds the lock that stops two workers acting on one broadcast. Running the pass there needs no new scheduler and no new coordination.

Catch-up runs once when the worker starts, so a broadcast that ended while nothing was running is picked up as soon as something is.

## Risks / Trade-offs

- **The pass runs where the worker runs, so a broadcast is only completed when a worker is up** → Catch-up on start means the delay is bounded by when the worker next runs, not lost. A broadcast can also be completed by running the pass by hand.
- **Scoring a whole broadcast is expensive and now runs automatically** → It runs once per broadcast, and the recorded state means a second run costs nothing. The scoring step already skips a broadcast that carries ratings.
- **A step could fail every time and be retried on every catch-up** → The record carries the failure and the attempt count, so a repeatedly failing broadcast is visible rather than silently retried forever.
- **The worker holds a lock during engagement but the pass runs after it releases** → The pass takes the broadcast's completion record as its own guard: a row is written before the steps run, so a second worker sees it and skips.
