## Context

Evidence, all from the production database unless stated:

- 12-Aug-2026: three August broadcasts recorded clean while holding roughly half their chat.
- 15-Aug-2026: the 8-Aug-2026 replay fetch succeeds and returns zero messages. Seven days after
  the broadcast there is nothing to recover.
- 19-Jul-2026: live capture held 295 messages, the replay held 275. The replay is not a superset
  of live capture, so merging is structurally necessary rather than a repair for a broken poller.

The poller itself was fixed on 15-Aug-2026 in `chat-capture-resilience`. This change is about
everything that happens after a broadcast ends.

## Decisions

### Two phases, not one deferred pass

Waiting a day before scoring would mean nobody sees credits, points or a membership from a
broadcast until the next day, which is the visible half of the product. Scoring only needs the
chat that exists; merging is what needs the replay.

Phase A, score, becomes ready as soon as the broadcast has ended. Phase B, settle, becomes ready
once the replay could plausibly exist.

Phase A deliberately does not fetch the replay. At ten minutes old the fetch cannot succeed, and
running it anyway is what produced a record claiming no gaps against an empty archive.

### Twenty hours before the replay is sought

The observed window is 16 to 24 hours. Twenty hours sits inside it, and a sweep every 30 minutes
means the cost of guessing low is one wasted fetch, not a missed merge. A fetch returning zero
does not mark the broadcast settled, so a low guess self-corrects on the next sweep.

### Seven days before giving up

The 8-Aug-2026 broadcast proves a replay can never arrive. Retrying it forever would keep a
broadcast unsettled indefinitely and hide the fact that its chat is unrecoverable. After seven
days the broadcast is settled with a note saying no replay was ever available, which is a
different statement from having merged one.

### Clean and settled are different claims

`clean` says every step of a phase succeeded. `settled` says the replay has been accounted for,
by merging it or by concluding there is none. Keeping them apart means no record has to be
un-written when a replay arrives later, and the audit trail of what passed on the night survives.

The sweep looks for broadcasts that are not settled. Absence of a record still means phase A is
owed, which preserves the existing behaviour for a broadcast that ended while nothing was running.

### A step is judged by what it did, not by whether it crashed

On 8-Aug-2026 the chat download printed `TypeError: fetch failed`, exited zero, saved nothing, and
was recorded as having worked. Exit codes cannot carry that difference.

Each step script prints a final line `::result {json}` and the runner parses it. The judging rule
is per step, because zero is a legitimate answer for some of them:

- `saveChatLog` reports `{ archived }`. Zero is not a failure: it means the replay is not
  available, which is what drives the twenty-hour and seven-day rules above.
- `topUpChat` reports `{ missing, inserted }`. Failure when `inserted < missing`, which is a
  partial write and is the case that must never be recorded as clean.
- `scoreChat` reports `{ scored, failed }`. Failure when `failed > 0`.
- `rebuildMemberships` reports `{ rebuilt }`.
- `checkLedger` reports `{ ok }` and saves nothing by nature, so it is judged on that flag alone.

A step whose output carries no result line is recorded as unknown rather than as success. Unknown
blocks `clean`, because a step that cannot say what it did has not been shown to have worked.

### The chat log step is scoped to one video

`backfill-youtube-chat.ts` sweeps every video it knows about, and the runner stores its last
output line against whichever broadcast triggered it. The 10-Aug record claims 20 messages
archived while that broadcast's archive holds 13. Scoping the step to one video makes the result
line true for the broadcast it is stored against, and is a precondition for judging it at all.

### One sweep per invocation

A long-running process can wedge silently, which is the exact class of fault this project has just
spent a change fixing in the chat reader. A command that does one sweep and exits cannot: the
scheduler starts it again regardless of how the last one ended, and a crash costs one cycle.

Each sweep settles at most three broadcasts, so one invocation cannot run for hours after a
backlog builds. Thirty minutes between sweeps clears a backlog of any realistic size overnight.

### The runner needs a real machine, not just a schedule

Settling a broadcast runs `yt-dlp` and a Claude call over the whole chat log, and reads Doppler
for the `prd` config. An always-on machine missing any of those fails every sweep silently.

The runner therefore performs a preflight before its first pass and refuses to start with a clear
statement of what is missing, rather than failing inside a step and recording that as a step
failure against a broadcast.

## Risks

- Removing the inline pass means a broadcast is settled by nothing until the runner is installed.
  The runbook makes installation the first step, and `npm run repair` remains as the manual path
  in the meantime.
- The seven-day rule permanently closes a broadcast whose replay was merely slow. Seven days is
  well beyond the observed 16 to 24 hour window, and the note records which rule closed it, so a
  wrongly closed broadcast is identifiable rather than indistinguishable from a merged one.
