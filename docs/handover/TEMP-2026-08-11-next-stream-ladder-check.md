# TEMP handover — what to check on the next broadcast, 14-Aug-2026

Delete this file once the ladder has been confirmed on a broadcast and both AZ-252 and AZ-222
are closed.

**Two sets of checks are waiting on the same broadcast.** Run the AZ-222 run-sheet, and add
the ladder checks below to it. One stream closes nine tickets; skipping either set means
streaming again to finish the job.

## AZ-222 — the run-sheet, run this first

Eight tickets are each waiting on a real broadcast, and AZ-222 orders them so one stream
closes them all. Open AZ-222 for the full checklist; the shape of it is:

- **Before going live:** worker running, encoder connected, YouTube simulcast on with live
  chat open, and a second device signed in as an account whose YouTube channel is **not** yet
  linked. The verification checks need that unlinked account, and there is no way to do them
  without it.
- **While the waiting room is open:** chat stays bounded and scrolls inside its own panel on a
  phone, with the composer still on screen (AZ-221).
- **In the first minutes:** the player controls (AZ-221), the smoke test that Nightbot posts
  into real YouTube chat with audible text-to-speech and live transcription running (AZ-157),
  and bot replies appearing exactly once, authored `VidsBot`, chunked within 200 characters
  (AZ-220).
- **Once chat has a few people in it:** the host is stored but never scored and gains no
  second identity (AZ-212); a first-time chatter gets a channel and membership on their first
  message, with credits earned and spent in the same broadcast (AZ-219); a new chatter's
  avatar renders at high resolution (AZ-200).
- **The verification event:** on the unlinked account the banner offers a code, posting it in
  YouTube chat clears the banner (AZ-201), and that same verification pools the two identities
  into one combined set of stats with no duplicate scoring rows (AZ-195).
- **After the stream ends:** the post-broadcast pass ran on its own, confirmed with
  `doppler run -- npx tsx scripts/verify-post-broadcast.ts` reporting the broadcast clean.

Close each ticket as its section passes, and AZ-222 when they all have.

---

# The quality ladder check

**Where it stands:** the ladder is installed on the streaming machine and the packaging is
proven there. Nothing about it has been seen on a real broadcast. That confirmation is all
that is left, and it closes AZ-252 and archives the OpenSpec change `add-live-quality-ladder`.

## Already true, do not redo

- The three ladder scripts, the ladder-aware live and not-ready hooks, the channel master
  playlist and the nginx `/ladder/` location are all installed on the machine.
- `https://stream.vids.tube/ladder/owner/master.m3u8` serves the master playlist now, with
  nothing live. Loading it proves nothing about a broadcast; it only proves nginx is right.
- Packaging passed on the machine's own ffmpeg build: three renditions advance, segment
  boundaries match, audio is identical across renditions, resolutions are correct, and the
  master lists only playlists the transcoder wrote.
- The stop path works on the machine: after the verification run no ffmpeg remained and the
  channel directory held `master.m3u8` and nothing else.
- MediaMTX config already matched the runbook and was not changed, so MediaMTX was not
  restarted. The hook scripts are read fresh on each broadcast, so no restart is needed for
  them to take effect.
- The previous hook scripts and the previous nginx site are kept beside the new ones with a
  `.pre-ladder` suffix.

## The check, in order, on the next broadcast

- **Before going live**, confirm nothing is already transcoding: `pgrep -af ffmpeg` on the
  machine must return nothing. A transcode left running between broadcasts is the expensive
  failure on a 2 vCPU box, and one was found running 27 hours past its limit on 11-Aug-2026.
- **In the first minute**, load `https://stream.vids.tube/ladder/owner/master.m3u8` and
  confirm all three rendition playlists advance rather than sitting frozen.
- **In the browser on the site**, confirm the quality menu lists three entries.
- **Throttle below 5 Mbps** and confirm playback drops quality and keeps going rather than
  stalling. Then pin a rendition and confirm it stays pinned under the same throttling.
- **Watch `top` for the whole broadcast.** Expect about half a core. The measurement was
  taken against a coding broadcast, which is cheap to encode; high-motion content costs more.
  If it approaches a full core sustained, drop to the single 720x1280 rung at 0.35 of a core
  before considering a bigger machine.
- **Measure the real latency and record it.** Expect 3 to 4 seconds, up from 1 to 3 seconds.
  This is a deliberate trade, not a fault: one ffmpeg produces all three renditions so that
  segment boundaries match by construction, and ffmpeg's HLS muxer has no `EXT-X-PART`.
  The owner took that trade on 10-Aug-2026, on the grounds that stalling costs a viewer more
  than lag does and chat lives on Vids.Tube rather than on the video. Do not chase the new
  latency as a bug.
- **After the broadcast ends**, confirm `pgrep -af ffmpeg` returns nothing and
  `/var/lib/vids-tube/hls/owner/` holds `master.m3u8` and nothing else.

## Clean up after a clean broadcast, not before

The previous hook scripts and the previous nginx site are still on the machine, each kept
beside its replacement with a `.pre-ladder` suffix. They are the rollback path that does not
depend on a checkout, so they stay until a broadcast has run cleanly with the ladder. Delete
them once it has:

```bash
ssh root@stream.vids.tube 'rm -f /usr/local/bin/mtx-live.sh.pre-ladder \
  /usr/local/bin/mtx-notready.sh.pre-ladder \
  /etc/nginx/sites-available/stream.vids.tube.pre-ladder'
```

## If it goes wrong

Add `Environment=LADDER_ENABLED=0` to the MediaMTX service and restart it. The transcoder
never starts, so its pid file never appears, so the live hook stops flagging a ladder and new
broadcasts record the single-rendition address again with latency back at 1 to 3 seconds.
Broadcasts already recorded are unaffected. No app deploy is involved either way.

## The verification script, now fixed

`verify-ladder.sh` used to need a repo checkout and Node, which the streaming machine has
neither of, so it could not run where the runbook said to run it. It now prefers the installed
`/var/lib/vids-tube/hls/<channel>/master.m3u8` and only generates one when running from a
checkout. On the machine it needs ffmpeg and nothing else, and it checks the exact playlist
production serves. It has been redeployed and re-run there unmodified: all sixteen checks
pass.

## Related

- **AZ-252** — install and verify on a broadcast. The install half is done.
- **AZ-222** — the run-sheet for everything else waiting on the next broadcast. The checks
  above are additional to it and could be folded into it instead of living here.
- **AZ-250** — superseded; its packaging decision is made and recorded.
- **AZ-35** — costing and the per-machine viewer ceiling, which changes once the ladder ships
  because viewers stop all pulling 5.0 Mbps. Deferred by the owner.
