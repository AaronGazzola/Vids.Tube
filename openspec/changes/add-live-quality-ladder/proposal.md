## Why

A viewer whose download dips has nothing lower to switch to, so the only thing the
player can do is stall. Measured against the live edge on 10-Aug-2026, about 70 minutes
into a broadcast: exactly one rendition is published, 1080x1920 at 5.0 Mbps. The same
broadcast simulcast to YouTube played smoothly throughout, because YouTube drops the
viewer to a lower quality instead of stalling.

This is the deferral coming due, not a regression. The original live-streaming design
chose "remux, not transcode — single rendition only" and listed adaptive bitrate as a
later item. Watching on vids.tube is now the thing being asked to work, so the deferral
has to end.

## What Changes

- The streaming machine runs **one transcoder** that reads the incoming stream once and
  writes all three rungs into a single playlist set: the publisher's own 1080x1920 at
  5.0 Mbps copied untouched, **720x1280 at about 2.5 Mbps** and **540x960 at about
  1.2 Mbps**. One process means one clock, which is what makes the rungs interchangeable.
- Audio is copied, not re-encoded, so every rung carries byte-identical audio and a
  switch cannot produce an audio glitch.
- Keyframes in the transcoded rungs are forced onto the same cadence as the source, so
  every rung's segments start at the same instants and a switch lands cleanly.
- A **master playlist** per channel advertises the three rungs. Viewers are handed the
  master; the player already lists whatever the manifest advertises and already allows
  pinning one, so the quality menu becomes meaningful without any player change.
- **Playback moves from roughly 1–3 s behind live to roughly 3–4 s.** The muxer that can
  produce an aligned ladder has no low-latency support. The owner took that trade on
  10-Aug-2026: stalling costs a viewer more than 2 s of lag does, and chat is on
  Vids.Tube rather than on the video.
- The rungs start when the encoder connects and stop when it disconnects, so a machine
  with no broadcast on it does no work.
- Recording is unaffected: the VOD is still captured from the publisher's own stream, so
  a recording never inherits transcode loss.
- The streaming machine, not the app, decides whether viewers are handed the master
  playlist: the live hook carries a flag while the ladder is enabled. So the ladder can be
  turned on and off on the machine alone, and the app can never hand out an address for a
  manifest that is not being produced.
- **BREAKING** for the stored playback address only, and only while the ladder is on: a
  stream going live then records the master playlist as its address rather than the
  single-rendition playlist. Addresses already stored on past broadcasts keep working,
  because the single-rendition playlist is still served at its existing address.

The machine does not need resizing. That was assumed when this change was opened, and the
assumption was checked before it was acted on: both rungs together cost 0.50 of a core and
run at 2.1x real time against a real recording of the 9-Aug-2026 broadcast, on the machine
as it stands. The ladder still ships behind a switch and its load is watched through the
first broadcast that runs it, because the cost depends on what is being streamed.

## Capabilities

### New Capabilities

- `live-quality-ladder`: which rungs are published, how they are derived from the
  publisher's stream, how they are advertised as one master playlist, and when they run.

### Modified Capabilities

- `live-playback`: the live source becomes a multi-rendition manifest, so the player is
  required to switch down under bandwidth pressure rather than stall, and the quality
  menu is required to list more than one entry during a live broadcast.
- `stream-pipeline`: the streaming machine gains a transcode stage alongside the remux,
  tied to the publish lifecycle, and the address handed to viewers changes.

## Impact

- **Streaming machine**: the on-ready and on-not-ready scripts gain the transcoder's
  lifecycle; nginx gains a static location serving the ladder. Nothing publishes into
  MediaMTX except the encoder, so MediaMTX gains no paths. No resize, on the measurement
  above. The per-machine viewer ceiling being worked out in AZ-35 still changes, because
  viewers stop all pulling 5.0 Mbps.
- **App**: the route that records a stream's playback address when the encoder connects
  records the master playlist while the machine reports a ladder. The loopback publish
  exception the first attempt added to publish authentication is removed, since nothing
  republishes any more.
- **Runbook**: `docs/runbooks/live-streaming-vm.md` is the deployment contract for the
  machine and is updated with the rung definitions, the master playlist, the new latency
  and the measured cost.
- **Unaffected**: the recording and finalize path, the worker's transcription pull (which
  builds its own address and should stay on the publisher's rung), and the player, which
  already supports multiple renditions.
