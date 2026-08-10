## Context

The streaming machine runs MediaMTX 1.18.2 behind nginx. MediaMTX accepts the RTMP
publish, remuxes it to low-latency HLS, and serves one playlist per path. It does not
transcode and it does not emit a usable multi-variant playlist.

Measured on the machine, 10-Aug-2026:

- 2 vCPU (AMD EPYC), 3.8 GB memory, 72 days up, idle between broadcasts.
- ffmpeg 8.0.1 with libx264. `h264_nvenc` and `h264_qsv` are listed as built-in encoders
  but there is no NVIDIA or Intel device on this machine, so encoding is software only.
- Every action is authenticated against the app (`authMethod: http`), including publish.

Measured against a real recording of the 9-Aug-2026 broadcast, held on the machine:

- The publisher sends 1080x1920 at 30 fps and 5.00 Mbps, matching what was measured at the
  live edge during the stalling.
- **The publisher's keyframe interval is 1.000 s**, not the 2 s inferred from the
  advertised target duration. The rungs are built against the measured value.
- **Both rungs together cost 0.50 of a core and run at 2.1x real time.** Sixty seconds of
  that broadcast transcoded to both rungs in 28.4 s wall, consuming 30.0 core-seconds.
  A single 720x1280 rung costs 0.35 of a core at 2.6x real time.

That last figure overturned the assumption this design was started on. The estimate was
roughly two cores, which is the whole machine; the measurement is a quarter of that. The
machine is not the constraint, and the resize this change was originally written around is
not a prerequisite.

### What the first attempt found, and why the design changed

The first attempt transcoded each rung and republished it into its own MediaMTX path, then
advertised the three paths from a hand-written master playlist. Driving it on the machine
killed both halves of that approach:

- **MediaMTX's `index.m3u8` is itself a multi-variant playlist**, and the media playlist it
  points at carries a `?session=` token minted fresh on every request. A master playlist
  cannot reference another master, and a static file cannot carry a per-viewer token.
- **Republishing over RTMP resets each rung's timeline.** Keyframe spacing was a correct
  1.000 s on every rung, but the rungs sat half a second out of phase with the source
  (source at x.056, rungs at x.533). Segments that do not begin at the same instants
  cannot be swapped mid-playback without a stutter, which is the exact fault the ladder
  exists to remove. `-force_key_frames source` does not fix it, because the offset comes
  from the republish hop rather than from keyframe placement.

The fix is to remove the republish hop: **one ffmpeg produces all three renditions into a
single HLS output**, so there is one packager, one clock, and one set of segment
boundaries. ffmpeg's HLS muxer has no low-latency support — `ffmpeg -h muxer=hls` on the
machine lists no `EXT-X-PART` option — so this route serves standard HLS at roughly 3–4 s
behind live, where MediaMTX's low-latency HLS runs at roughly 1–3 s.

**Decided by the owner, 10-Aug-2026: take the latency.** About 2 s of chat responsiveness
is traded for playback that does not stall. This matches how YouTube itself is built: one
packager per broadcast producing an aligned ladder, with latency offered as a tier rather
than maximised — YouTube's own low-latency tier is 5–15 s and its ultra-low tier 2–5 s, so
3–4 s remains at the fast end of what viewers meet elsewhere.

The player needs no work. It already lists whatever renditions the manifest advertises,
already allows pinning one, and already reports its own health through the Playback health
readout. The whole change lives on the machine, plus one line in the app.

## Goals / Non-Goals

**Goals:**

- A viewer who cannot sustain 5.0 Mbps keeps watching at a lower rendition instead of
  stalling.
- Every rendition behaves identically apart from picture: same packager, same segment
  cadence, same audio, so switching does not move the viewer or glitch the sound.
- The publisher's own stream is never re-encoded, and the recording never inherits
  transcode loss.
- No rendition work happens on a machine with no broadcast on it.
- The ladder can be turned off on the machine alone, without an app deploy, and viewers
  fall back to exactly today's playback.

**Non-Goals:**

- Changing the player. If the player needs changing, the design is wrong.
- Per-viewer or per-channel rung selection. Every channel gets the same three rungs.
- Hardware encoding. No device on this machine offers it.
- Holding the 1–3 s latency. Trading roughly 2 s for a working ladder is the decision this
  design is built on, not an open question.

## Decisions

### One ffmpeg produces every rendition into one HLS output

A single process reads the source once from `rtmp://127.0.0.1:1935/<slug>`, copies the
publisher's video untouched as the top rendition, scales the decoded video twice for the
lower rungs, and writes all three into one HLS output directory under
`/var/lib/vids-tube/hls/<slug>/`, which nginx serves as static files.

One process means one clock. Every rendition is cut by the same muxer against the same
timeline, so segment boundaries match by construction rather than by coincidence, which is
what the republish approach could not achieve.

Chosen over **republishing each rung into MediaMTX**, which was built, measured and found
to put the rungs half a second out of phase with the source. Chosen over **two processes**,
one per rung, which would decode the 5.0 Mbps source twice for no benefit.

Audio is copied rather than re-encoded, three times over. It costs nothing, and identical
audio across renditions removes a whole class of switching artefact.

Keyframes on the encoded rungs are pinned to the source's measured cadence with scene-cut
keyframes disabled, so the encoded rungs can be cut at the same instants as the copied top
rendition.

### No rendition is published back into MediaMTX

Because ffmpeg writes files rather than republishing, nothing on the machine publishes to
MediaMTX except the encoder itself. The rendition paths, and the loopback publish
exception the app carried to admit them, are both deleted.

This is strictly safer than the approach it replaces: every MediaMTX path is once again
publishable only with a stream key, and the app's publish authentication has no address
based exception in it at all.

### The master playlist is a static file written from the same rendition definitions

ffmpeg's variant playlists have fixed names (`stream_540.m3u8`, `stream_720.m3u8`,
`stream_1080.m3u8`) and carry no session token, so a static master can address them
directly, as siblings in the same directory.

The master is written by the app's own rendition definitions rather than by ffmpeg's
`-master_pl_name`, because ffmpeg derives each variant's advertised bandwidth from the
stream's declared bitrate, and an RTMP source frequently declares none — which would emit a
master whose top rendition advertises no bandwidth at all. Writing it from the same
definitions the transcoder is built from makes the advertised numbers exact and testable.

Renditions are listed lowest first, so a viewer whose bandwidth is not yet estimated starts
on something that will play rather than something that might not.

### The ladder is served on its own address, and the machine decides when it is used

nginx serves the ladder from `/ladder/<slug>/` as static files, leaving the existing proxy
to MediaMTX untouched at every other address. The single-rendition address keeps working
exactly as it does today, so every broadcast recorded before this change still resolves,
and turning the ladder off restores today's playback with no app change.

Which address a new broadcast records is decided by the machine, not the app: the live hook
carries a flag while a ladder is actually being produced, and the app records the master
playlist only when that flag is present. The machine is the only place that knows, so the
app can never record an address for a manifest that does not exist. This is what made the
first attempt's app change unsafe to ship.

The flag tracks production rather than intent — the transcoder's pid file and the channel's
master playlist both have to be there — and is recomputed on every 30 s heartbeat rather
than once at go-live. A heartbeat on a live broadcast already rewrites its playback address,
so a transcoder that never starts, or that dies for good, drops the broadcast back to the
single-rendition address within 30 s. Losing the ladder degrades playback to today's
behaviour instead of breaking it.

That is what makes it safe for **the ladder to be on by default**. Installing the transcoder
and writing a channel's master playlist is the whole of turning it on; `LADDER_ENABLED=0`
is the way back off. A viewer who cannot hold 5 Mbps is the normal case, so the ladder is
the normal configuration, and the failure direction is a channel quietly playing exactly as
it does today rather than a channel that does not play.

### The ladder follows the publish lifecycle, and restarts itself

The transcoder starts from the existing on-ready script and stops from the existing
on-not-ready script, which already bracket a broadcast and already handle the encoder
reconnecting. The output directory is cleared on stop, so a stale manifest never outlives
the broadcast that produced it.

Every rendition now comes out of one process, so that process failing takes all three down,
where the previous design would have left the top rendition served straight from MediaMTX.
The transcoder therefore supervises its own ffmpeg and restarts it while the broadcast is
still publishing, turning a crash into a few seconds of interruption rather than the end of
playback.

## Risks / Trade-offs

- **Playback moves from roughly 1–3 s behind live to roughly 3–4 s.** This is the decision,
  not a side effect. → Chat is the thing that feels it, and chat is on Vids.Tube rather
  than on the video, so a message arrives when it is sent regardless. Watched on the first
  broadcast that runs the ladder.
- **The whole ladder now depends on one process.** A transcoder crash stops every
  rendition, where the previous shape kept the top rendition alive. → The transcoder
  restarts its own ffmpeg while the encoder is still publishing, and turning the ladder off
  puts every viewer straight back on MediaMTX's own playlist.
- **The encode cost is content-dependent, and the measurement is of one kind of content.**
  0.50 of a core was measured against a coding broadcast, which is largely static text and
  cheap to encode. A high-motion scene costs more, and the margin is 2.1x rather than
  unlimited. → The ladder ships behind a switch, the machine's load is watched through the
  first broadcast that runs it, and the fallback is dropping to the single 720x1280 rung at
  0.35 of a core. Resizing is the last resort rather than the opening move.
- **Sustained encoding on a shared-vCPU plan can be throttled or stolen from.** → At half a
  core average the machine is nowhere near pegged, which is what makes a shared plan
  defensible here. If the load measured on a real broadcast approaches a full core
  sustained, the plan family becomes the question rather than the core count.
- **nginx now serves files another process is writing.** A half-written segment or playlist
  would break playback. → Segments and playlists are written to a temporary name and
  renamed into place, so a reader only ever sees a complete file.
- **Viewers cost CPU too, and the measurement was taken on an idle machine.** nginx serving
  a live audience runs alongside the transcoder. → The connection cap already bounds this,
  and the same first-broadcast load reading covers it.
- **Higher egress.** Renditions are only served when chosen, so total egress rises only
  where a viewer would previously have stalled. The per-response rate cap and the
  connection cap on the machine are unchanged and still bound the worst case.
- **Encoding load scales with concurrent broadcasts, not viewers.** One broadcaster is one
  ladder. This is fine for a single-streamer platform and is a real constraint the moment a
  second streamer publishes to the same machine. → Recorded against the costing work rather
  than solved here.
- **Switching has never been observed on this stack.** A manifest can be correct and still
  switch badly. → The change is not considered done on a manifest inspection: the packaging
  is proven by running the real transcoder against a source with a known cadence and
  comparing the segment boundaries it produces, and the on-stream confirmation drives a
  real browser.

## Migration Plan

1. Land the app change. Nothing changes for viewers yet: the machine is not reporting a
   ladder, so broadcasts still record the single-rendition address.
2. Prove the packaging with `scripts/vm/verify-ladder.sh`, which needs neither MediaMTX nor
   production.
3. Install the transcoder and the nginx location on the machine, write the channel's master
   playlist, and restart MediaMTX. That is what turns the ladder on. No resize.
4. Verify against a real publish, watching the machine's load and the measured latency for
   the whole broadcast, and confirming no transcode is left running afterwards.
5. Only if that load says so, drop to the single rung, and only then consider a larger
   machine.
6. Rollback is `LADDER_ENABLED=0` and restarting MediaMTX. New broadcasts record the
   single-rendition address again and latency returns to 1–3 s. Addresses stored on past
   broadcasts are unaffected either way.

## Open Questions

- What the encode costs on high-motion content. The measurement covers a coding broadcast,
  which is what this channel streams, so it is representative of today rather than of every
  broadcast this platform might carry.
- Whether 3–4 s of latency changes how the broadcast feels to run. Answered by running one,
  not by argument.
