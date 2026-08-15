# Maintenance runner

**Written 15-Aug-2026.** Durable.

Settling a finished broadcast used to run inside the live worker, at the end of
engagement. That was wrong twice over: it ran ten minutes after a broadcast,
when the YouTube chat replay does not exist for another 16 to 24 hours, and it
only ran at all if the worker happened to still be alive, which it is not,
because the worker is stopped the moment a broadcast ends.

**The live worker no longer settles broadcasts.** Until this runner is installed,
nothing does, and `npm run maintain` has to be run by hand.

---

## What it does

One sweep, then exits. Every 30 minutes.

- **Score phase.** A broadcast that has ended and carries no clean record gets
  its chat scored, memberships rebuilt and ledger checked. Runs on the first
  sweep after the broadcast, so credits and memberships land the same evening.
- **Settle phase.** From 20 hours after a broadcast ended, the chat replay is
  downloaded, missing messages are added, those messages are scored, and
  memberships are rebuilt again. A fetch that finds nothing leaves the broadcast
  unsettled, so a wait that proved too short corrects itself on a later sweep.
- **Giving up.** 7 days on, a broadcast whose replay never produced anything is
  settled and recorded as having had no replay available. That is a different
  record from having merged one. The 8-Aug-2026 broadcast established that a
  replay can fail to appear at all.

Each sweep settles at most 3 broadcasts and says how many it left.

---

## What the machine needs

The runner checks these before its first pass and exits naming what is missing,
rather than failing inside a step and recording that against a broadcast.

- **node** and the repository checked out.
- **Doppler**, authenticated, with the `prd` config selected. `npm run maintain`
  goes through `doppler run`.
- **yt-dlp** on the path. Downloads the chat replay.
- **claude** on the path and signed in. Scoring is a Claude call over the chat.

Check by hand with one sweep:

```bash
npm run maintain
```

---

## Install

Edit `scripts/macos/dev.vidstube.maintain.plist`, replacing `REPO_PATH` with the
checkout's absolute path and `USERNAME` with the account's short name. Then:

```bash
cp scripts/macos/dev.vidstube.maintain.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/dev.vidstube.maintain.plist
```

The job runs a login shell on purpose. launchd gives a job a bare environment,
so without it doppler, node and yt-dlp are not on the path and the preflight
fails every half hour.

To stop it:

```bash
launchctl unload ~/Library/LaunchAgents/dev.vidstube.maintain.plist
```

---

## Logs

```
~/Library/Logs/vidstube-maintain.log
~/Library/Logs/vidstube-maintain.error.log
```

A sweep with nothing owing prints `nothing owing`. That is the normal state
between broadcasts.

---

## Running a phase by hand

```bash
npm run repair                              # sweep, up to 5
npm run repair -- --stream <id>             # whichever phase that broadcast owes
npm run repair -- --stream <id> --phase settle   # force a phase early
```

Forcing `settle` before 20 hours have passed will download nothing and leave the
broadcast unsettled, which is the correct outcome rather than a fault.

---

## Checking the result

```bash
npm run chat:completeness
```

Compares, per broadcast, what live capture stored against what the replay holds
against what is stored now. Broadcasts predating 15-Aug-2026 overstate live
capture, and the report says so.
