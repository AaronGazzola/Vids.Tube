## Why

The post-broadcast pass runs inside the live worker, at the end of engagement, about ten minutes
after a broadcast ends. Its main job is to download the YouTube chat replay and add what live
capture missed, and the replay does not become downloadable for 16 to 24 hours. It runs at the
one moment it cannot do its main job.

It usually does not run at all. The worker is disconnected straight after a broadcast, so
engagement never reaches its end while the process is alive. `npm run repair` is the only thing
that reliably runs the pass, it is manual, and that is how a backlog of 46 broadcasts built up.

Then a broadcast recorded clean is skipped forever, so the replay arriving the next day is never
looked at. Three August broadcasts are recorded clean while holding roughly half their chat.

The two halves of the worker have nothing in common but the database. Live work needs the
broadcast happening and the encoder nearby. Settling a finished broadcast needs neither, takes
minutes of serial work per broadcast including a Claude call over the whole chat log, and wants
to happen a day later. Splitting them is also what makes other streamers possible: a live worker
is inherently per-broadcast and per-machine, while settling finished broadcasts is shared work
one runner can do for everyone.

Whether a replay can be waited for indefinitely was answered on 15-Aug-2026: the 8-Aug-2026
broadcast's replay fetch now succeeds and returns zero messages. That chat is gone. Waiting is
not free, and a broadcast cannot be left unsettled forever.

## What Changes

- **BREAKING** The live worker no longer runs the post-broadcast pass. It engages a broadcast and
  stops, so disconnecting it the moment a stream ends loses nothing.
- A maintenance runner does one sweep and exits, invoked by the operating system's scheduler on an
  always-on machine. Nothing long-lived to wedge, and a crash costs one cycle.
- Settling a broadcast becomes two phases against one broadcast, not one pass. Scoring runs as
  soon as the broadcast has ended, so credits and memberships land without waiting for a replay.
  Merging the replay runs once the replay could exist.
- `clean` keeps its meaning of every step having succeeded. A separate `settled` records that the
  replay has been accounted for, and the sweep looks for unsettled broadcasts rather than for a
  missing record, so no record is ever un-written.
- A broadcast whose replay never appears is settled after a bounded wait, recorded as having no
  replay rather than as complete.
- A step reports what it did for the one broadcast, and is judged on that rather than on its exit
  code. Nothing existing to save is recorded as its own outcome, distinct from having saved
  nothing when there was something to save.
- The chat log step is scoped to a single video, which also ends the completion record storing a
  summary totalled across every video the script has ever seen.

## Capabilities

### New Capabilities
- `maintenance-runner`: finished broadcasts are settled by a scheduled runner rather than by the
  live worker, in two phases, with a bounded wait for the replay.

### Modified Capabilities
- `post-broadcast-pass`: a step is judged by what it did for one broadcast, and the pass no longer
  runs from the live worker.
- `local-worker`: the worker engages broadcasts and does nothing after them.

## Impact

- `worker/index.ts` loses the inline pass; `worker/lib/post-broadcast.ts` gains phases and
  per-step results; `lib/post-broadcast-plan.ts` gains the readiness and judging rules.
- A migration adding `settled`, `settled_at` and `settle_note` to `broadcast_completions`.
- A new `worker/maintain.ts` and `npm run maintain`, a launchd template, and a runbook covering
  what the always-on machine needs.
- `scripts/backfill-youtube-chat.ts` gains a single-video mode; the step scripts gain a final
  machine-readable result line.
- `npm run repair` stays as the manual override.
