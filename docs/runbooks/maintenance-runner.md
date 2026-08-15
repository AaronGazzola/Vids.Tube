# Maintenance runner

**Written 15-Aug-2026.** Durable. This is the setup guide for the always-on
machine, written to be followed from a fresh checkout with nothing assumed.

Turn it on once. It stays on across reboots and logins, and settles every
broadcast from then on without anyone running anything.

---

## Turn it on

```bash
git clone git@github.com:AaronGazzola/Vids.Tube.git
cd Vids.Tube
npm install
doppler login && doppler setup        # select the prd config
npm run maintain:install
```

That is the whole thing. `maintain:install` runs one sweep first and refuses to
install if it fails, so a machine that cannot do the work says so immediately
rather than every 30 minutes into a log nobody reads.

Re-running `maintain:install` is safe. It is also how to move the checkout or
repair a broken install.

```bash
npm run maintain:status      # is it on, and what has it been doing
npm run maintain:uninstall   # turn it off
npm run maintain             # one sweep by hand, any time
```

macOS only, because it installs a launchd job. On any other system, schedule
`npm run maintain` however that system schedules things; nothing else changes.

---

## What the machine needs

The runner checks these before its first pass and exits naming what is missing,
rather than failing inside a step and recording that against a broadcast.

| What | Why | Check |
| --- | --- | --- |
| node, npm | runs everything | `node --version` |
| Doppler, authenticated, `prd` config | secrets | `doppler run -- printenv NEXT_PUBLIC_SUPABASE_URL` |
| yt-dlp | downloads the chat replay | `yt-dlp --version` |
| Claude CLI, signed in | scores chat | `claude --version` |

Paths are found rather than configured. `worker/lib/resolve-bin.ts` tries the
configured value, then the same path under this user's home, then the usual
install locations. **Do not edit a Doppler path to make a tool resolve.** Those
values are shared by every machine and user, so fixing one account breaks
another, which is exactly what kept recurring before 15-Aug-2026.

---

## What it does, and why it is two phases

Settling a finished broadcast used to run inside the live worker, at the end of
engagement. That was wrong twice over: it ran ten minutes after a broadcast, when
the YouTube chat replay does not exist for another 16 to 24 hours, and it only
ran if the worker happened to still be alive, which it is not, because the worker
is stopped the moment a broadcast ends.

**The live worker no longer settles broadcasts.** This runner is the only thing
that does.

One sweep, then exit, every 30 minutes:

- **Score phase.** A broadcast that has ended and carries no clean record gets
  its chat scored, memberships rebuilt and ledger checked. Runs on the first
  sweep after the broadcast, so credits and memberships land the same evening.
- **Settle phase.** From 20 hours after the broadcast ended, the chat replay is
  downloaded, missing messages added, those scored, memberships rebuilt again. A
  fetch that finds nothing leaves the broadcast unsettled, so a wait that proved
  too short corrects itself on a later sweep.
- **Giving up.** 7 days on, a broadcast whose replay never produced anything is
  settled and recorded as having had no replay available. A different record from
  having merged one. The 8-Aug-2026 broadcast established that a replay can fail
  to appear at all.

Each sweep settles at most 3 broadcasts and says how many it left. A backlog is
worked through across sweeps rather than in one long run.

It exits rather than sleeping between passes on purpose. A process that sleeps
can wedge and go quiet, which is the fault this project spent a change fixing in
the chat reader. A process that exits cannot: the scheduler starts the next one
regardless of how the last one ended, and a crash costs one cycle.

Overlapping sweeps are prevented by a lock in the temp directory, so a sweep that
outlasts its interval is left alone rather than doubled. A lock older than four
hours is treated as abandoned and cleared, so a machine killed mid-sweep recovers
by itself.

---

## Logs

```
~/Library/Logs/vidstube-maintain.log
~/Library/Logs/vidstube-maintain.error.log
```

`nothing owing` is the normal state between broadcasts.

A sleeping Mac does not run scheduled jobs. launchd runs a missed sweep once on
wake, so sleep delays settling rather than skipping it, but an always-awake
machine keeps the timing honest.

---

## Running a phase by hand

```bash
npm run repair                                    # sweep, up to 5
npm run repair -- --stream <id>                   # whichever phase it owes
npm run repair -- --stream <id> --phase settle    # force a phase early
```

Forcing `settle` before 20 hours have passed downloads nothing and leaves the
broadcast unsettled. That is the correct outcome, not a fault.

---

## Checking the result

```bash
npm run chat:completeness
```

Per broadcast: what live capture stored, what the replay holds, what is stored
now. Broadcasts predating 15-Aug-2026 overstate live capture, and the report says
so rather than presenting their figures as sound.
