# TEMP handover — deploying the live quality ladder, 11-Aug-2026

Delete this file once the ladder is running on the streaming machine and AZ-252 is closed.

**Where it stopped:** the code is written, proven and pushed. Nothing has been installed on
the streaming machine, because the workstation this was built on cannot log into it. That
access is the only blocker. Everything below is mechanical once it is solved.

---

## What is already true

- The change is committed and pushed to `main`, so the app side has auto-deployed to Vercel.
  The app now records the master playlist as a broadcast's playback address whenever the
  streaming machine says a ladder exists, and records the single-rendition address otherwise.
- **Nothing has changed for viewers.** The streaming machine has not been touched, so it is
  not reporting a ladder, so every broadcast still records and serves exactly what it did
  before.
- The packaging is proven. `scripts/vm/verify-ladder.sh` runs the real transcoder against a
  synthetic 1080x1920 source and asserts three playlists advancing, matching segment
  boundaries, identical audio and a master listing only playlists that exist. It passes.
- The OpenSpec change `add-live-quality-ladder` is code-complete and validates strict. It is
  deliberately **not archived**: archive it after the on-stream confirmation.

## The blocker

`ssh root@stream.vids.tube` from the Windows workstation fails with
`Permission denied (publickey)`. The workstation holds exactly one SSH key, it authenticates
to GitHub fine, and it is not in the machine's `authorized_keys` — so the box is
administered from somewhere else. The machine's host key has since been added to the
workstation's `known_hosts`, so that part is settled.

Fix: from wherever the box is already reachable, append the workstation's public key
(`~/.ssh/id_ed25519.pub` on the Windows box) to `~/.ssh/authorized_keys` on the machine.

## What the decision was, so it is not relitigated

One ffmpeg produces all three renditions into a single HLS output. That gives one clock, so
segment boundaries match by construction. ffmpeg's HLS muxer has no `EXT-X-PART`, so this
costs low-latency playback: **roughly 1–3 s behind live becomes roughly 3–4 s**. The owner
took that trade on 10-Aug-2026, on the grounds that stalling costs a viewer more than lag
does and chat lives on Vids.Tube rather than on the video. Do not treat the new latency as a
fault to chase.

The approach it replaced — transcoding each rung and republishing it into its own MediaMTX
path — was built, measured and abandoned: republishing over RTMP reset each rung's timeline,
leaving the rungs half a second out of phase with the source, and MediaMTX's `index.m3u8`
turned out to be a multivariant playlist carrying a per-viewer session token that no static
master could reference.

## Installing on the machine

Full detail is in [`docs/runbooks/live-streaming-vm.md`](docs/runbooks/live-streaming-vm.md),
which is the deployment contract. The short form:

```bash
# 1. scripts, from a checkout of this repo
scp scripts/vm/mtx-ladder.sh scripts/vm/mtx-ladder-stop.sh scripts/vm/verify-ladder.sh \
    root@stream.vids.tube:/usr/local/bin/
ssh root@stream.vids.tube chmod +x /usr/local/bin/mtx-ladder.sh /usr/local/bin/mtx-ladder-stop.sh
```

```bash
# 2. on the machine: the channel's master playlist, written once
mkdir -p /var/lib/vids-tube/hls/owner
cat > /var/lib/vids-tube/hls/owner/master.m3u8 <<'EOF'
#EXTM3U
#EXT-X-VERSION:7
#EXT-X-INDEPENDENT-SEGMENTS
#EXT-X-STREAM-INF:BANDWIDTH=1400000,RESOLUTION=540x960,CODECS="avc1.64001e,mp4a.40.2"
stream_540.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=2700000,RESOLUTION=720x1280,CODECS="avc1.64001f,mp4a.40.2"
stream_720.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=5400000,RESOLUTION=1080x1920,CODECS="avc1.640028,mp4a.40.2"
stream_1080.m3u8
EOF
```

3. Replace `/usr/local/bin/mtx-live.sh` and `/usr/local/bin/mtx-notready.sh` with the
   versions in the runbook. `mtx-live.sh` is the important one: it flags a ladder on the
   live hook **only while one is actually being produced**, judged from the transcoder's pid
   file and the master playlist, and it re-checks on every heartbeat.
4. Delete the `owner_720` and `owner_540` path declarations from
   `/usr/local/etc/mediamtx.yml`. Nothing publishes into MediaMTX any more except the
   encoder.
5. Add the `/ladder/` location to the nginx site from the runbook, then
   `nginx -t && systemctl reload nginx && systemctl restart mediamtx`.

**Do not restart MediaMTX during a broadcast.** Check `pgrep -af ffmpeg` first.

## Verifying, in this order

1. On the machine, with nothing live: `sh /usr/local/bin/verify-ladder.sh`. Proves the
   packaging on the machine's own ffmpeg build. Touches neither MediaMTX nor production.
2. Go live from OBS. `https://stream.vids.tube/ladder/owner/master.m3u8` should load, and
   all three rendition playlists should advance.
3. Watch `top` for the whole broadcast. Expect about half a core. The measurement was taken
   against a coding broadcast, which is cheap to encode; high-motion content costs more.
   If it approaches a full core sustained, drop to the single 720x1280 rung at 0.35 of a
   core before considering a bigger machine.
4. In a browser on the site: the quality menu lists three entries. Throttle below 5 Mbps and
   confirm playback drops quality and keeps going rather than stalling. Pin a rendition and
   confirm it stays pinned under throttling.
5. Measure the real latency and record it. The expectation is 3–4 s.
6. End the broadcast, then confirm `pgrep -af ffmpeg` returns nothing and
   `/var/lib/vids-tube/hls/owner/` holds `master.m3u8` and nothing else. A transcode left
   running between broadcasts is the expensive failure on a 2 vCPU box.

## Rolling back

Add `Environment=LADDER_ENABLED=0` to the MediaMTX service and restart it. The transcoder
never starts, so its pid file never appears, so the live hook stops flagging a ladder and
new broadcasts record the single-rendition address again with latency back at 1–3 s.
Broadcasts already recorded are unaffected either way. No app deploy is involved in either
direction.

## Related

- **AZ-252** — this work: install on the machine and verify on a broadcast.
- **AZ-250** — was "decide the packaging, then switch it on". The decision half is done and
  is recorded above; the remainder is AZ-252.
- **AZ-242** — the original stalling measurement and the four candidate fixes.
- **AZ-35** — costing and the per-machine viewer ceiling. Still changes once the ladder
  ships, because viewers stop all pulling 5.0 Mbps.

## Noticed on the way, unrelated

- **AZ-253** — the post-broadcast repair backlog. `doppler run -- npx tsx
  scripts/verify-post-broadcast.ts` reports 46 ended broadcasts that never completed the
  pass cleanly: 40 with no record and 6 attempted and failed. One of the six is the
  **10-Aug-2026** broadcast, the one the AZ-222 run-sheet was worked through on — two
  attempts, no finish time, no step results at all, so nothing was stored to diagnose from.
  Clearing the lot is one command, `npm run repair -- --limit 46`, which takes the most
  recent first so 10-Aug goes first. The default limit of 5 is a deliberate brake, not a
  bug: each broadcast is minutes of serial work plus a Claude call over its whole chat log,
  so run it attended and keep the terminal output. AZ-222 cannot close until 10-Aug reads
  clean.
- **AZ-196** claims the vitest toolchain is broken. It is not: unit tests run with
  `NODE_OPTIONS=--experimental-require-module doppler run -- npx vitest run`. The Node flag
  is needed until Node moves past 22.12, and Doppler supplies the env vars three worker
  tests import. The ticket looks closeable.
