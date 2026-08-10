# Tasks — a quality ladder for live playback

**Evidence rule.** A box is checked only with a result that would have failed had the work
not been done. A manifest that parses is not evidence: a manifest listing renditions that
do not exist also parses. Evidence is three playlists advancing, segment boundaries that
match, and a browser that actually changes rendition under throttling and keeps playing.

**Verification runs against a disposable copy of the machine's configuration**, stood up
locally with a synthetic publisher, not against production. Production has one channel and
one stream key, and publishing to it would create a real broadcast row and go live. The
copy runs the same MediaMTX version with the same HLS settings, so what is proven
transfers.

**The on-stream confirmation is AZ-250**, because it cannot be finished in code. The
machine is not resized: both rungs measured 0.50 of a core at 2.1x real time against a
real recording, on the machine as it stands.

> **BLOCKED, 10-Aug-2026 — the design's packaging approach does not work, and the fix
> costs about 2 seconds of live latency, which is the owner's call.** Sections 2 and 4
> are done and proven. Section 5 is built on a false assumption and must be rewritten.
> Full detail, including the three options put to the owner, is in
> `TEMP-2026-08-10-quality-ladder-handover.md`. Resolve that question before touching
> anything below.

## 1. Know the source before matching it

- [x] 1.1 Measured, and the assumption it replaced was wrong. The publisher sends
      1080x1920 at 30 fps and 5.00 Mbps with a keyframe every **1.000 s**, read from the
      keyframe positions in a real recording. The design had inferred 2 s from the
      advertised target duration; building on that would have left half the segment
      boundaries unaligned.
- [ ] 1.2 Add `scripts/measure-source-cadence.ts` taking an HLS address, reading the
      playlist's advertised target duration and probing keyframe positions with `ffprobe`,
      and printing the measured keyframe interval, so the cadence is re-read rather than
      carried as a constant the encoder can silently change.
- [ ] 1.3 Have the script fail loudly, naming both numbers, when the keyframe interval is
      not a whole multiple of the segment duration, since that is the condition under which
      segments cannot align across renditions.

## 2. The transcoder

- [x] 2.1 Done. `scripts/vm/mtx-ladder.sh` reads the source once over loopback and
      publishes both renditions. Confirmed on the machine: ffprobe against the running
      rungs reports h264 720x1280 and 540x960 at 30 fps.
- [x] 2.2 Confirmed by probing both rungs and the source: aac, 48000 Hz, stereo on all
      three. Audio is copied, not re-encoded.
- [x] 2.3 Partly, and the remainder is not solvable in this script. Scene-cut keyframes are
      off and the interval is the measured 1.000 s, confirmed by probing every rung. The
      rungs are nonetheless half a second out of phase with the source (source at x.056,
      rungs at x.533), because republishing over RTMP resets the timeline. Two attempts
      failed: a timer expression, then `-force_key_frames source`. Alignment cannot be
      fixed here; it needs the packaging decision in the handover.
- [x] 2.4 Done, with a bounded rate on both rungs.
- [x] 2.5 Done — process id file, refusal when the source is unreachable, and a log line
      either way.

## 3. The lifecycle

- [ ] 3.1 Extend `/usr/local/bin/mtx-live.sh` in the runbook to start the ladder in the
      background alongside the existing heartbeat, so it starts when an encoder connects.
- [ ] 3.2 Extend `/usr/local/bin/mtx-notready.sh` in the runbook to stop the ladder, so no
      transcoding happens on a machine with no broadcast.
- [ ] 3.3 Declare `owner_720` and `owner_540` in the runbook's `mediamtx.yml` with no
      recording and no on-ready or on-not-ready hooks, so publishing into a rendition path
      cannot start a second heartbeat, a second recording, or a loop.
- [ ] 3.4 Add a single switch to the runbook configuration that leaves the ladder off, so
      the change lands without altering what viewers receive until it is deliberately
      turned on and watched.

## 4. Admitting the transcoder's publish

- [x] 4.1 Done in `lib/renditions.ts` rather than the ingest module, so the definition is
      shared and testable without pulling in a database client.
- [x] 4.2 Done. A rendition publish is admitted from loopback and refused, with a log line
      naming the address, from anywhere else.
- [x] 4.3 Confirmed by reading the route: a channel path still turns on its stream key
      alone, from any address.
- [x] 4.4 Done, in `tests/unit/ingest-auth-rendition.test.ts`. Covers the loopback forms
      MediaMTX reports, remote addresses, a missing address defaulting closed, and
      addresses that merely begin with the loopback digits.

## 5. The master playlist

> **This whole section rests on a false assumption and must be rewritten once the
> packaging decision is made.** MediaMTX's `index.m3u8` is itself a multivariant playlist
> carrying a per-viewer session token, so a static master cannot reference it. The code
> and tests exist and pass, but what they build cannot be served. See the handover.

- [ ] 5.1 Add `lib/master-playlist.ts` with a pure function building a master playlist from
      a channel path and a rendition list, emitting bandwidth, resolution and codecs per
      rendition, ordered lowest bandwidth first, addressing each rendition relative to the
      master.
- [ ] 5.2 Add `scripts/vm/write-master-playlist.ts` writing that file for a channel to the
      location nginx serves, so the file on the machine is generated from the same
      definition the tests cover rather than hand-written twice.
- [ ] 5.3 Add the nginx location to the runbook serving `/<slug>/master.m3u8` from that
      file, with the same CORS treatment the existing location applies, so a master playlist
      is fetchable by a browser on another origin.
- [ ] 5.4 Add `tests/unit/master-playlist.test.ts` asserting the ordering, that each
      rendition address resolves relative to the master to the address MediaMTX serves, and
      that the advertised bandwidth of each rendition exceeds its configured rate.

## 6. Handing viewers the ladder

- [ ] 6.1 Record the master playlist as the broadcast's playback address. **Attempted and
      deliberately reverted**: main auto-deploys, and pointing broadcasts at a master
      playlist that does not exist on the machine would have broken the next broadcast
      outright rather than leaving it merely unimproved. Do this only once the packaging
      decision is made and the manifest is actually served.
- [ ] 6.2 Leave the single-rendition address serving unchanged, so addresses stored on
      earlier broadcasts still resolve. Assert this in `tests/e2e/live-vod.spec.ts` rather
      than assuming it.
- [x] 6.3 Confirmed by reading `worker/config.ts`: the worker builds its own address from
      its own configuration and stays on the publisher's rendition, so it is unaffected by
      whatever viewers are handed.

## 7. Prove the ladder works

- [ ] 7.1 Add `tests/integration/quality-ladder.setup.ts` standing up MediaMTX with the
      runbook's HLS settings and the rendition paths, and a synthetic publisher generating a
      1080x1920 source at the production bitrate with a known keyframe interval.
- [ ] 7.2 Assert all three playlists advance, by reading each twice and requiring new
      segments, so a rendition that is merely present but frozen fails.
- [ ] 7.3 Assert segment boundaries match across the three renditions, and that the audio of
      each lower rendition is identical to the top rendition's.
- [ ] 7.4 Add `tests/e2e/quality-ladder.spec.ts` loading the master playlist in a real
      browser, asserting the quality menu lists three renditions.
- [ ] 7.5 In that spec, throttle the browser's network below the top rendition's bitrate and
      assert the player changes rendition and keeps playing, with no stall recorded. This is
      the check that distinguishes a correct manifest from a working ladder.
- [ ] 7.6 In that spec, assert a viewer who pins a rendition stays on it under throttling,
      so the menu is a real choice rather than a suggestion.

## 8. Land it

- [ ] 8.1 Update `docs/runbooks/live-streaming-vm.md` so the overview diagram, the
      `mediamtx.yml` block and the nginx block all describe the ladder, since the runbook is
      the deployment contract for the machine.
- [ ] 8.2 Correct the runbook's stated sizing. It reads "CPX21/CPX22 is ample for
      remux-only", which now implies a resize is needed for a ladder. Record the measured
      cost instead, so the next reader is not told to buy a bigger machine on an assumption
      that was tested and found wrong.
- [ ] 8.3 Run `openspec validate --strict` and archive.
