# Handover — DELETE AFTER READING

**Written 14-Aug-2026. Disposable by design.**

This is a one-shot baton, not a reference. Read it once, act on it, then delete
it. Never cite it as a source and never update it in place in a later session.

**Do not delete `docs/runbooks/next-broadcast-checklist.md`.** That is a durable
document for the owner to work through during a broadcast, not a handover.

## Where the durable record lives

- `docs/roadmap.md`, build position refreshed 14-Aug-2026.
- `openspec/specs/` for behaviour; the archived changes under
  `openspec/changes/archive/` for why.
- `CLAUDE.md` for governance. Those documents win wherever this one disagrees.

## What this session changed

Four changes shipped and archived on 13-Aug and 14-Aug-2026, all on `/live`:

- The Overlays tab shows every overlay at its real value, including empty ones,
  through the same renderer the OBS route uses.
- Settings can be inherited from a previous broadcast. The thumbnail became an
  ordinary field, so choosing one no longer writes immediately and no longer
  discards the rest of the form.
- The members box became the message banner, renamed through the database, and
  is now written as styled text inside the banner itself.
- Each banner message can carry one of nine live metrics with an icon.

Measured at the end of the session: 601 unit tests across 50 files, typecheck,
lint and a production build all passing, and 13 browser tests across the banner,
the Overlays tab and the settings tab.

## The two jobs for this session

### 1. A dev view for the live video and chat experience

The owner needs to work on the live-page UX — how chat reads and behaves, how the
playback controls feel, how the layout holds at different screen sizes — without
going public and without an encoder running.

What already exists, so this is not built from nothing:

- `scripts/dryrun-stream.ts` creates a real broadcast titled `[DRY RUN]` with its
  data and cleans it up afterwards. This is the closest existing thing and the
  obvious base.
- The demo generator in `app/(app)/live/demo.stores.ts` and `useDemoController`
  seed and tick simulated chatters, messages, TTS and ask requests. It already
  drives the Activity tab's demo toggle and the Overlays tab's Demo switch.
- The unified player is one component for live and VOD, so the playback controls
  under test are the real ones.
- The viewer-facing surface is `app/[channelSlug]/live/page.tsx`.

Decide before building: whether the dev view drives the real viewer page against
a dry-run broadcast, or renders that page against the demo generator with no
broadcast row at all. The first exercises the true data path; the second needs no
database writes and cannot leak. Not settled.

Constraints the owner stated: not visible publicly, no encoder, and it must show
chat behaviour rather than a screenshot of it.

### 2. The chat completeness problem

Do not re-derive this. The evidence below was gathered on 12-Aug-2026 by reading
the production database directly.

**The symptom.** Three August broadcasts are recorded clean while holding roughly
half their chat.

- 9-Aug-2026: 9 messages stored against 20 in the YouTube replay. Live capture
  stopped at 13:58; the broadcast ran to 14:59 and the replay holds messages to
  14:57. About an hour of chat was never captured.
- 10-Aug-2026: 7 stored against 13. Capture ran the whole window and still missed
  about half.
- 8-Aug-2026: the chat log step reported `TypeError: fetch failed`, the archive is
  still empty, and the broadcast is marked clean.

**Four separate faults, all confirmed.**

- The live chat poller stops part-way through a broadcast while the worker keeps
  heartbeating. Gap detection watches the heartbeat, not whether chat is still
  arriving, so it recorded only the 1.3 minutes between the worker stopping and
  the broadcast ending, and missed the preceding hour.
- The post-broadcast pass runs about ten minutes after a broadcast ends, but the
  YouTube replay does not become downloadable for 16 to 24 hours. The top-up
  compares stored chat against an empty archive and truthfully reports no gaps.
- A clean record is then written, and a clean broadcast is skipped forever, so
  chat that arrives later is never merged.
- A step is judged by whether its child process exited without error, not by
  whether any chat was saved, which is how 8-Aug passed with an empty archive.

**Two traps.**

- The replay is not a superset of live capture. On 19-Jul-2026 live capture held
  295 messages and the replay held 275. The truth is the union, so a merge step
  is structurally necessary even after the poller is fixed.
- The step detail stored on a completion record is a global summary, not a
  per-broadcast one: the chat log script runs across every known video and its
  last line is stored against whichever broadcast triggered it. The 10-Aug record
  claims 20 messages archived while that broadcast's archive holds 13. Do not
  trust that field as evidence.

**Decisions still owed, all deferred by the owner on 12-Aug-2026.**

- Whether a clean record should become revocable, so a replay arriving later
  re-opens the broadcast.
- Whether the pass should run once, deferred until the replay exists, or twice,
  scoring immediately and merging later.
- Whether a step that saves nothing may count as success.
- Whether the mid-broadcast poller stall is investigated first, since it is the
  only fault whose fix reduces how much repair is needed at all.

**Nothing measures this today.** No per-broadcast comparison of messages captured
live against messages in the replay against their union exists. That measurement
is what makes the problem visible, and building it first is the recommendation.

## Traps

- `npx supabase db push` applies every pending migration, not only the one just
  written. On 14-Aug-2026 it carried an unrelated migration from a parallel
  session into production. Check `supabase/migrations` against the remote before
  pushing.
- Run scripts under the selected Doppler config. Passing `--config dev_personal`
  breaks anything importing `worker/config.ts`, because the streaming host is
  only in `prd`. The one exception is scripts using the Supabase Management API.
- The game window browser test fails until the eco3d game is deployed. That is
  AZ-245 and is not a regression.

## Tried and rejected

- Fabricated stand-in figures in the banner editor. Removed on 14-Aug-2026: a
  layout composed against numbers that will never appear is a layout composed
  against nothing.
- Rendering an unavailable metric as nothing. Replaced by a dash on 14-Aug-2026,
  because a vanishing metric takes its space with it and moves the layout.
- Byte-identical markup round-tripping. Impossible: the dialect does not record
  the order nested marks were written in. Meaning and every visible character are
  preserved instead.

## How to run it

```bash
NODE_OPTIONS=--experimental-require-module doppler run -- npx vitest run
doppler run -- npx playwright test tests/e2e/<spec>.spec.ts
NEXT_PUBLIC_STREAM_HOST=https://stream.vids.tube doppler run --preserve-env -- npx next build
```

The owner runs their own dev server on port 3000. Playwright reuses it; do not
start a second one, because Next refuses two dev servers for one directory.
