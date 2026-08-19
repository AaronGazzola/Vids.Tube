# Next broadcast — what to check while live

**Written 14-Aug-2026.** Durable until the broadcast it describes has happened.
This is not a handover document and is not deleted on read: `/sync` deletes
handovers, and this has to survive until there is a stream to run it against.

Nine tickets and one OpenSpec change are waiting on a single broadcast. Working
through this in order closes all of them.

**Tickets chosen to build on stream**, in the order they demo best. Detail is on
each ticket; this is here so the run sheet and the build list live together.

- **AZ-261, highlights-only toggle on the Activity tab.** Small, visible, and it
  pays off the moment the AI features a message while chat is watching. Best
  single one to build live.
- **AZ-266, message display timer and border toggle.** A global display time with
  an optional per-message override, plus a switch for the banner border. Both
  change the overlay while people are watching it.
- **AZ-262, goal overlays animate when a metric increments.** Purely visual, and
  a new subscriber arriving during the broadcast is the demo.
- **AZ-263, welcome messages in the overlay.** Chatters arriving are the trigger,
  so the audience makes it happen.
- **AZ-264, credits for a new member on first chat.** Worth doing, weakest on
  camera: the effect is a number, and it needs a first-time chatter on cue. Its
  amount is a decision to settle against the ticket pricing model first.

Not for stream: **AZ-260**, the dev view for live video and chat UX, and
**AZ-265**, trimming the waiting room off the 10-Aug-2026 recording.

---

## Before going live

- Confirm nothing is already transcoding on the streaming machine:
  `ssh root@stream.vids.tube 'pgrep -af ffmpeg'` must return nothing. A transcode
  left running between broadcasts is the expensive failure on a 2 vCPU box, and
  one was found running 27 hours past its limit on 11-Aug-2026.
- Worker running, encoder connected, YouTube simulcast on with live chat open.
- Sign in on a second device with an account whose YouTube channel is **not** yet
  linked. The verification checks are impossible without it.

---

## 1. The run-sheet (AZ-222)

Eight tickets, each closed by its own section. Full detail is on AZ-222; the
shape of it:

- **Waiting room:** chat stays inside its own panel on a phone, composer on
  screen (AZ-221).
- **First minutes:** the player controls (AZ-221); Nightbot posting into real
  YouTube chat with audible text-to-speech and live transcription running
  (AZ-157); bot replies appearing exactly once, authored `VidsBot`, chunked
  within 200 characters (AZ-220).
- **Once chat has people:** the host stored but never scored (AZ-212); a
  first-time chatter getting a channel, membership and credits in the same
  broadcast (AZ-219); a new chatter's avatar at high resolution (AZ-200).
- **The verification event:** the banner offers a code, posting it in YouTube
  chat clears it (AZ-201), and that same verification pools the two identities
  with no duplicate scoring rows (AZ-195).
- **After it ends:** the post-broadcast pass ran on its own, confirmed with
  `doppler run -- npx tsx scripts/verify-post-broadcast.ts`.

Close each ticket as its section passes, and AZ-222 when they all have.

---

## 2. The quality ladder (AZ-252)

Installed and proven on the machine on 11-Aug-2026: sixteen packaging checks
passed against the machine's own ffmpeg build, and the stop path leaves nothing
running. What has never been seen is a real broadcast.

- In the first minute, load `https://stream.vids.tube/ladder/owner/master.m3u8`
  and confirm all three rendition playlists advance rather than sitting frozen.
- In a browser on the site, confirm the quality menu lists three entries.
- Throttle below 5 Mbps: playback must drop quality and keep going rather than
  stalling. Pin a rendition and confirm it holds under the same throttling.
- Watch `top` for the whole broadcast. Expect about half a core. If it approaches
  a full core sustained, drop to the single 720x1280 rung at 0.35 of a core
  before considering a bigger machine.
- Measure the real latency and record it. Expect 3 to 4 seconds, up from 1 to 3.
  This is a deliberate trade taken on 10-Aug-2026, on the grounds that stalling
  costs a viewer more than lag does and chat lives on Vids.Tube rather than on
  the video. Do not chase it as a fault.
- After the broadcast: `pgrep -af ffmpeg` returns nothing, and
  `/var/lib/vids-tube/hls/owner/` holds `master.m3u8` and nothing else.

**If it goes wrong:** add `Environment=LADDER_ENABLED=0` to the MediaMTX service
and restart it. New broadcasts record the single-rendition address again and
latency returns to 1 to 3 seconds. Broadcasts already recorded are unaffected,
and no app deploy is involved either way.

Once confirmed, close AZ-252 and archive the OpenSpec change
`add-live-quality-ladder`, which is deliberately still active at 38 of 39 tasks.

---

## 3. The banner metrics

Nine metrics shipped on 14-Aug-2026, seven of them scoped to the broadcast. None
has ever returned a live number, because nothing has been live since they were
written. Only the off-air path is proven, where each shows its icon and a dash.

Put a message on the banner carrying each of these and confirm the number is
right and moves:

- New subs this stream, likes this stream, current viewers.
- Chats this stream, chat commands this stream, unique chatters this stream.
- New members this stream.

Watch particularly for unique chatters: it counts distinct participants from the
chat itself, and the same person chatting from YouTube and from the site must
count once each rather than merging or double-counting.

Total subs and members are the two that already show off air.

---

## 4. The OBS overlay surface

The overlay route was rewritten four times between 12-Aug and 14-Aug-2026: the
renderer was extracted, the metrics were added, absence became a dash, and the
counts became per-broadcast. It passes its tests and has never once been looked
at in OBS.

- Confirm every enabled overlay draws where it should and at the size it should.
- Confirm the message banner cycles, and that a message carrying a metric shows
  its number rather than a dash once the broadcast is live.

---

## 5. The task list and its overlay reveal (AZ-278)

Built 19-Aug-2026 and never seen live. The list is managed from the Settings tab
and from a checkbox button in the Activity tab header, and the overlay shows it
briefly whenever a save changes it.

- Save a list from the Settings tab, then edit it mid-broadcast from the Activity
  tab popover. Nothing may reach the overlay until Save is pressed.
- Mark a task complete and save: the reveal opens on the previous state, ticks
  the box, holds and fades.
- Press Show in overlay: the saved list draws with nothing animated.
- Refresh the OBS browser source: nothing replays.
- Save while a highlight is on screen: the highlight plays out first.

Full check list is on AZ-278; close it when they all pass.

---

## 6. After a clean broadcast, not before

Delete the rollback copies from the streaming machine once the ladder has run
cleanly through a broadcast:

```bash
ssh root@stream.vids.tube 'rm -f /usr/local/bin/mtx-live.sh.pre-ladder \
  /usr/local/bin/mtx-notready.sh.pre-ladder \
  /etc/nginx/sites-available/stream.vids.tube.pre-ladder'
```

They are the rollback path that does not depend on a checkout, which is why they
stay until there is a clean broadcast behind them.

---

## 6. Chat capture (AZ-259)

Shipped 15-Aug-2026: the YouTube chat reader now retries a failed page read
instead of ending silently, and the Settings tab shows whether capture is alive.
Neither can be proven without a broadcast, because neither has seen one.

- Early in the broadcast, open the Settings tab of `/live` and confirm a second
  indicator reads "YouTube chat capture working", below the worker indicator.
- Glance at it again through the broadcast. Turning red means YouTube messages
  have stopped being stored, and the fix on the night is to restart the worker.
  That is the exact condition that went unnoticed for an hour on 9-Aug-2026, when
  every other signal said the broadcast was healthy.
- After the broadcast, and again after the replay has been merged, run
  `npm run chat:completeness`. This is the first broadcast whose messages record
  whether they arrived from live capture or from the replay, so it is the first
  whose figures mean anything. Every earlier broadcast overstates live capture
  and the report says so.
- What good looks like: live capture close to the archive count, and no shortfall
  flagged. A shortfall means the reader still stopped, and the worker log carries
  the reason as `[chat:yt] page read failed`.

---

## 7. The recording starts at go-live (AZ-265)

The trim in `scripts/vm/mtx-finalize-vod.sh` cuts everything before go-live off
the first segment. The installed copy is byte-identical to the repo copy, and no
broadcast has run since it was deployed, so this is its first test.

- Use a waiting room, long enough to be obvious. Note the wall-clock minute the
  go-live button is pressed.
- After the broadcast, confirm the published recording opens at go-live and not
  in the waiting room, and that its duration matches the live window rather than
  the whole session.
- The 10-Aug-2026 recording carries 13 minutes of waiting room. That one predates
  the deploy and is being repaired separately.

---

## 8. Scoring actually runs (AZ-259)

Live chat scoring spawns the Claude CLI through `CLAUDE_BIN`. On 15-Aug-2026 that
was set to `claude.cmd`, which no longer exists on the streaming PC, so every
scoring batch failed. The 9-Aug-2026 broadcast scored nobody for this reason.

- Before going live, confirm `CLAUDE_BIN` resolves. One sweep of
  `npm run maintain` refuses to start and names it if it does not.
- During the broadcast, confirm messages are being featured and the leaderboard
  moves. Nothing scored after a busy stretch means the CLI is not spawning.

---

## 9. The broadcast settles itself (AZ-259)

The live worker no longer settles a finished broadcast, so stopping it the moment
the stream ends is now correct and loses nothing. The maintenance runner does it
on a schedule instead.

- Confirm the runner is installed on the always-on machine first. Until then
  nothing settles a broadcast. See `docs/runbooks/maintenance-runner.md`.
- Within an hour of the broadcast ending, the completion record should carry a
  clean score phase: chat scored, memberships rebuilt, ledger checked.
- The next day, roughly 20 hours on, the same broadcast should be settled with a
  note saying the replay was merged.
- Then run `npm run chat:completeness`. This is the first broadcast whose
  messages record whether they arrived from live capture or from the replay, so
  it is the first whose figures mean anything.

---

## Known and not a regression

- The game window browser test fails until the eco3d game is deployed. That is
  AZ-245.
- The 8-Aug-2026 broadcast's chat replay no longer exists. The fetch succeeds and
  returns zero messages, so the roughly half of that broadcast's chat live
  capture missed is unrecoverable. Confirmed 15-Aug-2026.
- The 8-Aug-2026 recording is 21 minutes shorter than its live window, because it
  was swapped for the YouTube version. Not being repaired.
