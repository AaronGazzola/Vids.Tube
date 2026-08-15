# Handover — DELETE AFTER READING

**Written 15-Aug-2026. Disposable by design.**

This is a one-shot baton, not a reference. Read it once, act on it, then delete
it. Never cite it as a source and never update it in place in a later session.

**Do not delete anything in `docs/runbooks/`.** Those are durable:
`next-broadcast-checklist.md` for the run sheet, `maintenance-runner.md` for the
always-on machine, `live-streaming-vm.md` for the streaming machine.

## Where the durable record lives

`docs/roadmap.md`, `openspec/specs/`, `CLAUDE.md`, and Linear. Those win wherever
this disagrees.

## Read this first: nothing needs an env var edited any more

This session's last change makes the worker find its own tools. `WHISPER_BIN`,
`WHISPER_MODEL`, `FFMPEG_BIN` and `CLAUDE_BIN` in Doppler all point into the
development account's home. Under the broadcast account they resolve to the same
paths under that user's home instead, and a name that will not run falls back to
the usual install locations.

**Pull main before streaming**, then run one check:

```bash
npm run worker:doctor
```

Every line should pass. It passed on the development account on 15-Aug-2026 with
the Doppler values untouched. If a line fails, that tool genuinely is not
installed on the broadcast account, and the message says which.

Do not "fix" this by editing a Doppler value. That is what broke it the last
several times: one shared value cannot be right for two accounts.

## Build these on stream, in this order

Each ticket carries the detail. This is why each was picked.

1. **AZ-261, highlights-only toggle on the Activity tab.** Start here. Small,
   visible, and it pays off the moment the AI features a message while chat is
   watching. Note while building: a `!command` message can be featured, since the
   only filter is `!m.isHost`. It has never happened in 66 featured messages.
2. **AZ-266, message display timer and border toggle.** A global display time
   with an optional per-message override, and a switch for the banner border.
   Both change the overlay while people watch.
3. **AZ-262, goal overlays animate on increment.** Purely visual, and a new
   subscriber arriving is the demo. Do not animate on first paint, or on the
   Overlays tab while a layout is being dragged.
4. **AZ-263, welcome messages in the overlay.** Chatters arriving are the
   trigger, so the audience makes it happen.
5. **AZ-264, credits for a new member on first chat.** Weakest on camera. Its
   amount is a decision to settle against the ticket pricing model first.

Not for stream: **AZ-260** (dev view for live UX) and **AZ-265** (trimming the
waiting room off the 10-Aug recording).

## What this session changed, that the broadcast will exercise

- The YouTube chat reader retries a failed read instead of ending silently, and
  the Settings tab shows whether capture is alive, separately from the worker.
- The recording trim that cuts everything before go-live is deployed and has
  never met a broadcast.
- Settling a finished broadcast left the live worker. Stopping the worker the
  moment the stream ends now loses nothing.
- Recordings are dated by when the broadcast started, so the channel and the
  studio agree.

`docs/runbooks/next-broadcast-checklist.md` sections 6 to 9 say what to watch.

## Traps

- **The maintenance runner is not installed.** Until the launchd job is loaded on
  the always-on Mac, nothing settles a broadcast. Run `npm run maintain` by hand
  after the stream, or install it first. See `docs/runbooks/maintenance-runner.md`.
- `npx supabase db push` applies every pending migration, not only the newest.
  Check `supabase migration list --linked` before pushing.
- Another agent works in this repository. Never `git add -A`; stage your own
  paths.
- The game window browser test fails until the eco3d game is deployed. AZ-245,
  not a regression.

## Tried and rejected

- Editing `CLAUDE_BIN` when the account changes. It fixes one account by breaking
  the other, which is why this recurred.
- Swapping a recording for the YouTube version to fix it. That cost the
  8-Aug-2026 recording 21 minutes against its live window, so AZ-265 trims
  instead.
- Judging a step by whether its process exited without an error. On 8-Aug-2026 a
  step printed a network failure, exited zero, saved nothing, and was recorded as
  having worked.

## How to run it

```bash
npm run worker:doctor
npm run worker
npm run maintain                # after the broadcast, until launchd runs it
npm run chat:completeness       # after the replay has been merged
NODE_OPTIONS=--experimental-require-module doppler run -- npx vitest run
```
