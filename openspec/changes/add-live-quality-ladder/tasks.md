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

**The machine resize and the on-stream confirmation are AZ-250**, because neither can be
finished in code.

## 1. Know the source before matching it

- [ ] 1.1 Add `scripts/measure-source-cadence.ts` taking an HLS address, reading the
      playlist's advertised target duration and probing one segment with `ffprobe` for its
      keyframe positions, and printing the measured keyframe interval. Design records that
      2 s is inferred from one measurement rather than known.
- [ ] 1.2 Have the script fail loudly, naming both numbers, when the keyframe interval is
      not a whole multiple of the segment duration, since that is the condition under which
      segments cannot align across renditions.

## 2. The transcoder

- [ ] 2.1 Add `scripts/vm/mtx-ladder.sh` taking the channel path, reading
      `rtmp://127.0.0.1:1935/<path>` once and publishing two renditions back to
      `rtmp://127.0.0.1:1935/<path>_720` and `<path>_540`. One process, one decode, video
      split and scaled twice, per the design.
- [ ] 2.2 In that script, copy audio rather than re-encoding it, so every rendition carries
      byte-identical audio.
- [ ] 2.3 In that script, fix the keyframe interval to the value measured in 1.1 and disable
      scene-cut keyframes, so no rendition gains a keyframe the others lack.
- [ ] 2.4 Encode 720x1280 at about 2.5 Mbps and 540x960 at about 1.2 Mbps with a bounded
      rate, so a complex scene cannot push a rendition above the bandwidth its master
      playlist entry advertises.
- [ ] 2.5 Have the script write its process id to a known location and exit non-zero when
      the source is unreachable, so the lifecycle hooks can stop it and a failure to start
      is visible in the machine's log rather than silent.

## 3. The lifecycle

- [ ] 3.1 Extend `/usr/local/bin/mtx-live.sh` in the runbook to start the ladder in the
      background alongside the existing heartbeat, so it starts when an encoder connects.
- [ ] 3.2 Extend `/usr/local/bin/mtx-notready.sh` in the runbook to stop the ladder, so no
      transcoding happens on a machine with no broadcast.
- [ ] 3.3 Declare `owner_720` and `owner_540` in the runbook's `mediamtx.yml` with no
      recording and no on-ready or on-not-ready hooks, so publishing into a rendition path
      cannot start a second heartbeat, a second recording, or a loop.
- [ ] 3.4 Add a single switch to the runbook configuration that leaves the ladder off, so
      the change lands without altering what viewers receive until AZ-250 resizes the
      machine.

## 4. Admitting the transcoder's publish

- [ ] 4.1 In `app/api/ingest/_shared.ts` (or the auth route it serves), recognise a
      rendition path as the channel path plus a rendition suffix, so a rendition path is
      distinguishable from a channel path rather than guessed at.
- [ ] 4.2 In `app/api/ingest/auth/route.ts`, authorise a publish to a rendition path when
      the publisher's address is the machine's own loopback, and reject it otherwise.
      Reading the publisher's address from the authentication call is what makes this
      possible without a new secret.
- [ ] 4.3 Leave channel paths unchanged: a publish to a channel path is still authorised
      only by its stream key, from any address.
- [ ] 4.4 Add `tests/unit/ingest-auth-rendition.test.ts` asserting all four cases: loopback
      publish to a rendition path is admitted; non-loopback publish to a rendition path is
      rejected with and without a valid stream key; a channel-path publish still turns on
      the key alone.

## 5. The master playlist

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

- [ ] 6.1 In `app/api/ingest/live/route.ts`, record the master playlist as the broadcast's
      playback address instead of the single-rendition playlist.
- [ ] 6.2 Leave the single-rendition address serving unchanged, so addresses stored on
      earlier broadcasts still resolve. Assert this in `tests/e2e/live-vod.spec.ts` rather
      than assuming it.
- [ ] 6.3 Confirm by reading the worker's transcription path that it builds its own address
      from its own configuration and is therefore unaffected; if it is not, keep it on the
      publisher's rendition.

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
      `mediamtx.yml` block, the nginx block and the machine sizing all describe the ladder,
      since the runbook is the deployment contract for the machine.
- [ ] 8.2 Run `openspec validate --strict` and archive.
