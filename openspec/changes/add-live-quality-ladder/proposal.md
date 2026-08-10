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

- The streaming machine transcodes two lower rungs from the incoming stream and
  publishes each as its own playlist: **720x1280 at about 2.5 Mbps** and
  **540x960 at about 1.2 Mbps**. The publisher's own 1080x1920 at 5.0 Mbps stays as the
  top rung and is still never re-encoded.
- Audio is copied, not re-encoded, so every rung carries byte-identical audio and a
  switch cannot produce an audio glitch.
- Keyframes in the transcoded rungs are forced onto the same cadence as the source, so
  every rung's segments start at the same instants and a switch lands cleanly.
- A **master playlist** per channel advertises the three rungs. Viewers are handed the
  master; the player already lists whatever the manifest advertises and already allows
  pinning one, so the quality menu becomes meaningful without any player change.
- The rungs start when the encoder connects and stop when it disconnects, so a machine
  with no broadcast on it does no work.
- Recording is unaffected: the VOD is still captured from the publisher's own stream, so
  a recording never inherits transcode loss.
- **BREAKING** for the stored playback address only: a stream going live now records the
  master playlist as its address rather than the single-rendition playlist. Addresses
  already stored on past broadcasts keep working, because the single-rendition playlist
  is still served at its existing address.

Not in this change, and deliberately: the machine has to be resized before the rungs fit,
which is owner work and is tracked separately. The change is written so that the code and
configuration land first and the resize is the last step before it is switched on.

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

- **Streaming machine**: MediaMTX gains two rung paths; the on-ready and on-not-ready
  scripts gain the transcoder's lifecycle; nginx gains the master playlist. The machine
  must move from 2 vCPU to 8 vCPU before the rungs can run, which changes the per-machine
  viewer ceiling and the cost curve being worked out in AZ-35.
- **App**: the route that records a stream's playback address when the encoder connects
  now records the master playlist.
- **Runbook**: `docs/runbooks/live-streaming-vm.md` is the deployment contract for the
  machine and is updated with the rung definitions, the master playlist, and the resize.
- **Unaffected**: the recording and finalize path, the worker's transcription pull (which
  builds its own address and should stay on the publisher's rung), and the player, which
  already supports multiple renditions.
