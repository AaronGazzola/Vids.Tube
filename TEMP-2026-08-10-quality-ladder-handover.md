# TEMP handover — live quality ladder, 10-Aug-2026

Delete this file once the ladder ships or is abandoned.

**Where it stopped:** the encoding works and is proven. The packaging does not, and
the fix costs about 2 seconds of live latency. **That trade-off is an unanswered
question for the owner** and is the first thing to resolve in the next session.

---

## The problem being solved

Live playback stalls on vids.tube. Exactly one rendition is published, 1080x1920 at
5.0 Mbps, so a viewer whose download dips has nothing lower to switch to and the
player can only buffer. The same broadcast on YouTube plays smoothly because YouTube
drops the viewer to a lower quality. Full measurement in AZ-242.

The chosen fix (of four options in AZ-242) is to publish a real quality ladder.

## What is proven

Measured on the streaming machine against a real recording of the 9-Aug-2026
broadcast, using a second MediaMTX instance on ports 1936/8890 so production was
never touched.

| | |
| --- | --- |
| both rungs together | **0.50 of a core, 2.1x real time** |
| single 720x1280 rung | 0.35 of a core, 2.6x real time |
| rungs produced | 720x1280 and 540x960, h264, 30 fps, confirmed by ffprobe |
| audio on each rung | aac 48000 Hz stereo, identical to source (copied, not re-encoded) |
| publisher | 1080x1920, 30 fps, 5.00 Mbps |
| publisher keyframe interval | **1.000 s** |

**The machine does NOT need resizing.** An earlier estimate of "roughly two cores"
was wrong by about fourfold and had a Hetzner resize planned around it. That plan is
cancelled. A first benchmark that appeared to show the machine struggling was invalid:
it generated a synthetic 1080x1920 source in the same pass, which cost more than the
transcode being measured.

## What is broken, and why

Two findings, both from driving it rather than reading docs. Both invalidate the
design as written in `openspec/changes/add-live-quality-ladder/`.

### 1. MediaMTX's `index.m3u8` is already a master playlist

The design assumed each MediaMTX path serves a plain media playlist that a
hand-written master could list. It does not. `GET /<path>/index.m3u8` returns:

```
#EXT-X-STREAM-INF:BANDWIDTH=5180358,CODECS="avc1.640028,mp4a.40.2",RESOLUTION=1080x1920,...
video1_stream.m3u8?session=f9d597c2-4ec9-47e5-bff5-192a467506ea
```

That is a multivariant playlist. A master cannot reference another master. Worse, the
`?session=` token **is minted fresh on every request** — two probes seconds apart
returned different ids — so no static file can carry it.

### 2. The three renditions do not share a clock

Republishing each rung into its own MediaMTX path gives each one an independent
timeline origin. Measured keyframe positions:

```
source    36.056  37.056  38.056   → phase .056
test_720  37.533  38.533  39.533   → phase .533
test_540  43.533  44.533  45.533   → phase .533
```

Spacing is a correct 1.000 s everywhere, but the rungs sit half a second out of phase
with the source. Segments that do not start at the same instants cannot be swapped
mid-playback without a stutter — the exact fault the ladder exists to remove.

Attempted fix that did **not** work: `-force_key_frames source`. The offset comes from
the RTMP republish hop resetting timestamps, not from where the encoder places
keyframes. (The first attempt used `-force_key_frames expr:...` on a timer, which was
also wrong; the script now carries `source`, still insufficient on its own.)

## The decision waiting for the owner

The fix is to let **one ffmpeg produce all three renditions into a single HLS output**:
one packager, one clock, a master playlist ffmpeg writes itself, nginx serving the
files. Verified that ffmpeg supports this — the `hls` muxer has `-var_stream_map` and
`-master_pl_name`. The source rung joins the same output as a `copy` stream so all
three share one timeline.

**The cost:** ffmpeg's HLS muxer has no low-latency support. Confirmed by inspecting
`ffmpeg -h muxer=hls` on the machine: no `EXT-X-PART` option exists. Today the stream
runs MediaMTX's low-latency HLS at roughly 1–3 s behind live. This route lands at
roughly 3–4 s.

So: **about 2 seconds of chat responsiveness, traded for playback that does not stall.**

Options put to the owner, not yet answered:

1. **Take the 2 seconds.** One ffmpeg packager, standard HLS, real switching. The
   recommendation, on the grounds that stalling hurts a viewer more than 2 s of lag.
2. **Keep the low latency.** Build a route that assembles a master playlist per viewer,
   fetching each rung's `index.m3u8` and extracting its fresh session-scoped media
   playlist URL. Keeps 1–3 s, but the three streams still have separate clocks, so
   switching may jump. `EXT-X-PROGRAM-DATE-TIME` is present in MediaMTX's media
   playlists and is the only lever for aligning them. Unproven and more moving parts.
3. **Abandon the ladder** and take AZ-242's cheaper options instead: widen the player's
   buffer target and the edge window. Reduces stalling without fixing it, and also
   costs latency.

## State of the code on main

Everything below is committed. **Nothing is live to viewers**, and the machine's
production configuration is untouched.

**Safe and working:**

- `lib/renditions.ts` — rung definitions, path suffixes, `parseRenditionPath`.
- `lib/loopback.ts` — loopback address detection.
- `app/api/ingest/auth/route.ts` — admits a publish to a rung path only from the
  machine's own loopback, rejects it from anywhere else. This is how the transcoder
  publishes without a stream key and without exempting the paths from authentication.
  **Do not** use MediaMTX's `authHTTPExclude` here; it would leave the rung paths
  publishable by anyone who can reach port 1935.
- `scripts/vm/mtx-ladder.sh`, `scripts/vm/mtx-ladder-stop.sh` — the transcoder and its
  stop. Off unless `LADDER_ENABLED=1`. Already copied to `/usr/local/bin/` on the
  machine, where they are inert because the flag is unset and the production
  `mtx-live.sh` has not been changed.
- `scripts/measure-source-cadence.ts` — reads keyframe cadence from a live stream and
  refuses when it is not a whole multiple of the segment duration.
- `tests/unit/master-playlist.test.ts`, `tests/unit/ingest-auth-rendition.test.ts` —
  17 tests, passing.

**Known not viable, kept only as a starting shape:**

- `lib/master-playlist.ts` → `buildMasterPlaylist`. Carries a warning comment.
  `variantPlaylistUrl` in the same file *is* correct and is what the live route uses.
- `scripts/vm/write-master-playlist.ts` — writes the file that cannot work.
- The `master.m3u8` nginx block in the runbook — marked do-not-deploy.

**Deliberately reverted before committing:**

- `app/api/ingest/live/route.ts` was changed to record `master.m3u8` as a broadcast's
  playback address, and was put back to `index.m3u8`. Main auto-deploys to Vercel, and
  `master.m3u8` does not exist on the machine, so shipping it would have broken the
  next broadcast completely rather than merely leaving it unimproved.

## How to re-run the proof

The harness lives in the session scratchpad, not the repo. To rebuild it: stand up a
second MediaMTX on 1936/8890 with paths `test`, `test_720`, `test_540` and no auth;
publish `/var/lib/vids-tube/rec/owner/2026-08-09_13-44-30-158885.mp4` in a loop with
`-re -stream_loop -1 -c copy` to `rtmp://127.0.0.1:1936/test`; run
`LADDER_ENABLED=1 LADDER_RTMP_HOST=127.0.0.1:1936 mtx-ladder.sh test`; then probe the
three playlists. Machine access is `ssh -i ~/.ssh/id_ed25519 root@stream.vids.tube`.

Watch for two traps that cost time here:

- MediaMTX only starts its HLS muxer when a reader first asks, and 404s until segments
  exist. Request each playlist once, then wait about 10 s before asserting anything.
- Comparing keyframe *spacing* proves nothing. Compare the *fractional phase*; that is
  what exposed the misalignment.

## Related tickets

- **AZ-242** — the stalling, with the original measurement and all four candidate fixes.
- **AZ-250** — switching the ladder on and watching the machine. Rewritten: it no longer
  asks for a resize.
- **AZ-35** — costing and the per-machine viewer ceiling. Still changes if the ladder
  ships, because viewers stop all pulling 5.0 Mbps.
- **AZ-222** — run-sheet for the next broadcast.

## Unrelated things noticed on the way

- **AZ-196** claims the vitest toolchain is broken with `ERR_REQUIRE_ESM`. It is not:
  `npx vitest run` works, 450 tests pass. Three test files fail without Doppler because
  they need real environment variables; `doppler run -- npx vitest run` passes all of
  them. The ticket looks closeable.
- **AZ-243** is open and urgent: nine `SECURITY DEFINER` database routines are callable
  by a signed-out visitor, two of which move credits. Unrelated to the ladder but it is
  the most serious thing currently outstanding.
