## Context

The streaming machine runs MediaMTX 1.18.2 behind nginx. MediaMTX accepts the RTMP
publish, remuxes it to low-latency HLS, and serves one playlist per path. It does not
transcode and it does not emit a multi-variant playlist: one path is one rendition.

Measured on the machine, 10-Aug-2026:

- 2 vCPU (AMD EPYC), 3.8 GB memory, 72 days up, idle between broadcasts.
- ffmpeg 8.0.1 with libx264. `h264_nvenc` and `h264_qsv` are listed as built-in encoders
  but there is no NVIDIA or Intel device on this machine, so encoding is software only.
- Every action is authenticated against the app (`authMethod: http`), including publish.
- `authHTTPExclude` and `runOnInit` are both supported by this build.

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

The player needs no work. It already lists whatever renditions the manifest advertises,
already allows pinning one, and already reports its own health through the Playback
health readout. The whole change lives on the machine, plus one line in the app.

## Goals / Non-Goals

**Goals:**

- A viewer who cannot sustain 5.0 Mbps keeps watching at a lower rendition instead of
  stalling.
- Every rendition behaves identically apart from picture: same packager, same segment
  cadence, same part duration, same audio, so switching does not move the viewer or
  glitch the sound.
- The publisher's own stream is never re-encoded, and the recording never inherits
  transcode loss.
- No rendition work happens on a machine with no broadcast on it.

**Non-Goals:**

- Changing the player. If the player needs changing, the design is wrong.
- Per-viewer or per-channel rung selection. Every channel gets the same three rungs.
- Hardware encoding. No device on this machine offers it.
- Revisiting the low-latency target. Latency is what the ladder exists to protect;
  trading it away was the alternative this change was chosen over.

## Decisions

### Rungs are produced by one ffmpeg process and republished into MediaMTX

One process reads the source once from `rtmp://127.0.0.1:1935/<slug>`, splits the decoded
video, scales it twice, and publishes each result back into MediaMTX as its own path,
`<slug>_720` and `<slug>_540`.

Chosen over **two processes**, one per rung, which would decode the 5.0 Mbps source twice
for no benefit. Chosen over **ffmpeg writing HLS files directly to disk for nginx to
serve**, which avoids a re-ingest hop but produces the rungs with a different packager
from the top rung. Two packagers means two segment cadences and two latencies inside one
manifest, so a viewer switching rungs would jump in time. Keeping every rung inside
MediaMTX is what makes the rungs interchangeable.

Audio is copied rather than re-encoded. It costs nothing, and identical audio across
rungs removes a whole class of switching artefact.

### Rung paths are publishable only from the machine itself

Publishing into MediaMTX is authenticated against the app, and a rung path has no stream
key of its own, so the publish would be rejected.

MediaMTX includes the publisher's address in the authentication call. The ingest-auth
route therefore admits a publish to a rung path when, and only when, the request comes
from the machine's own loopback address. A rung path is not publishable from the
internet, and no new secret is introduced.

Chosen over `authHTTPExclude`, which would exempt the rung paths from authentication
altogether and leave them publishable by anyone who can reach the RTMP port. Chosen over
handing the channel's stream key to the transcoder, which would mean serving a stream key
to the machine over an endpoint that does not need to exist.

### Keyframes are forced onto the source's cadence

Segments can only be interchangeable if every rung starts its segments at the same
instants. The transcoder therefore fixes its keyframe interval to the source's, and
disables scene-cut keyframes, which would otherwise insert extra keyframes at moments
that differ per rung.

The cadence was measured rather than assumed, and the assumption was wrong. The
advertised target duration of 2 against a 1 s segment duration implied a 2 s publisher
keyframe interval; reading the keyframe positions out of a real recording shows 1.000 s.
Building the rungs on the inference would have given every rung a keyframe every second
segment, so half of the segment boundaries could not have aligned.

Because the encoder's setting can change without warning, the transcoder still reads the
cadence rather than carrying 1 s as a constant, and refuses to start when the cadence is
not a whole multiple of the segment duration.

### The master playlist is a static file served by nginx

MediaMTX cannot emit a multi-variant playlist, so one is written per channel and served
by nginx at `/<slug>/master.m3u8`, listing the three renditions by relative address.

Chosen over **generating the master in the app**, which would put an app round-trip in
front of every viewer's playback and would still not know which rungs are actually up.
A static file is also readable and diffable on the machine, which matters for a
deployment whose contract is a runbook.

Renditions are listed lowest first, so a viewer whose bandwidth is not yet estimated
starts on something that will play rather than something that might not.

### The ladder follows the publish lifecycle

The transcoder starts from the existing on-ready script and stops from the existing
on-not-ready script, which already bracket a broadcast and already handle the encoder
reconnecting. Rung paths declare no recording and no on-ready hook of their own, so
publishing into them cannot start a second heartbeat, a second recording, or a loop.

## Risks / Trade-offs

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
- **Viewers cost CPU too, and the measurement was taken on an idle machine.** nginx serving
  a live audience runs alongside the transcoder. → The connection cap already bounds this,
  and the same first-broadcast load reading covers it.
- **A dead transcoder leaves the master advertising renditions that 404.** → The top rung
  is listed and is served directly by MediaMTX, so it survives any transcoder failure,
  and a player that cannot load a variant drops it and keeps playing. The failure mode is
  today's behaviour, not a worse one.
- **Higher egress.** Renditions are only served when chosen, so total egress rises only
  where a viewer would previously have stalled. The per-response rate cap and the
  connection cap on the machine are unchanged and still bound the worst case.
- **Encoding load scales with concurrent broadcasts, not viewers.** One broadcaster is
  one ladder. This is fine for a single-streamer platform and is a real constraint the
  moment a second streamer publishes to the same machine. → Recorded against the costing
  work rather than solved here.
- **Switching has never been observed on this stack.** A manifest can be correct and
  still switch badly. → The change is not considered done on a manifest inspection: the
  verification drives a real browser, forces a drop, and asserts the rendition changed
  while playback continued.

## Migration Plan

1. Land the app change and the machine configuration with the ladder off. Nothing changes
   for viewers: the top rung is still served at its existing address.
2. Switch the ladder on, on the machine as it is. No resize.
3. Verify against a real publish, watching the machine's load for the whole broadcast.
4. Only if that load says so, drop to the single rung, and only then consider a larger
   machine.
5. Rollback is stopping the transcoder and serving the single-rendition address again.
   Addresses stored on past broadcasts are unaffected either way, because the
   single-rendition playlist keeps its address throughout.

## Open Questions

- Whether hls.js follows MediaMTX's session redirect for a variant playlist listed in a
  master is asserted by the verification rather than assumed; if it does not, the master
  lists the session-scoped addresses instead.
- What the encode costs on high-motion content. The measurement covers a coding broadcast,
  which is what this channel streams, so it is representative of today rather than of every
  broadcast this platform might carry.
