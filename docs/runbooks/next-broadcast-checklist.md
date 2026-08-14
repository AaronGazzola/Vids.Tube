# Next broadcast — what to check while live

**Written 14-Aug-2026.** Durable until the broadcast it describes has happened.
This is not a handover document and is not deleted on read: `/sync` deletes
handovers, and this has to survive until there is a stream to run it against.

Nine tickets and one OpenSpec change are waiting on a single broadcast. Working
through this in order closes all of them.

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

## 5. After a clean broadcast, not before

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

## Known and not a regression

- The game window browser test fails until the eco3d game is deployed. That is
  AZ-245.
- Chat capture is known to lose messages mid-broadcast, and the post-broadcast
  pass currently marks such broadcasts clean anyway. Deferred on 12-Aug-2026 and
  being worked separately. If chat looks thin on the night, that is the known
  fault rather than a new one.
