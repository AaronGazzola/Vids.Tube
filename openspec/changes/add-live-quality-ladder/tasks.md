# Tasks — a quality ladder for live playback

**Evidence rule.** A box is checked only with a result that would have failed had the work
not been done. A manifest that parses is not evidence: a manifest listing renditions that
do not exist also parses. Evidence is three playlists advancing, segment boundaries that
match, and audio that is identical across renditions.

**The packaging question is answered, 10-Aug-2026.** One ffmpeg produces all three
renditions into a single HLS output, so there is one clock and boundaries match by
construction. This costs low-latency playback: ffmpeg's HLS muxer has no `EXT-X-PART`
support, so playback moves from roughly 1–3 s behind live to roughly 3–4 s. The owner took
that trade. The rendition paths, their republish hop and the loopback publish exception the
first attempt built are all removed rather than kept.

**The on-stream confirmation is AZ-250**, because it cannot be finished in code: switching
the ladder on, watching the machine's load and the real latency for a whole broadcast, and
confirming in a real browser that a throttled viewer changes rendition and keeps playing.

**The machine is not resized.** Both rungs measured 0.50 of a core at 2.1x real time
against a real recording, on the machine as it stands.

## 1. Know the source before matching it

- [x] 1.1 Measured, and the assumption it replaced was wrong. The publisher sends
      1080x1920 at 30 fps and 5.00 Mbps with a keyframe every **1.000 s**, read from the
      keyframe positions in a real recording. The design had inferred 2 s from the
      advertised target duration; building on that would have left half the segment
      boundaries unaligned.
- [x] 1.2 Done. `scripts/measure-source-cadence.ts` takes an HLS address, reads the
      playlist's advertised target duration, probes keyframe positions with `ffprobe`, and
      prints the measured keyframe interval, so the cadence is re-read rather than carried
      as a constant the encoder can silently change.
- [x] 1.3 Done. The script exits non-zero naming both numbers when the keyframe interval is
      not a whole multiple of the segment duration, which is the condition under which
      segments cannot align across renditions.

## 2. One transcoder, one output

Sections 2.1 to 2.5 replace the republishing transcoder that was built and measured. The
measurements carry over unchanged, because the decode-and-encode work is identical; only
where the output goes has changed.

- [x] 2.1 Rewrite `scripts/vm/mtx-ladder.sh` so a single ffmpeg reads the source once from
      loopback and writes all three renditions into one HLS output directory per channel
      under `/var/lib/vids-tube/hls/<slug>/`, with fixed variant playlist names carrying no
      session token, so a static master can address them as siblings.
- [x] 2.2 In that command, carry the publisher's video as a copied stream rather than an
      encoded one, so the top rendition is the publisher's own picture and costs no encode.
- [x] 2.3 In that command, copy the audio onto all three renditions rather than encoding it
      once per rendition, so the audio is byte-identical wherever a viewer switches.
- [x] 2.4 In that command, pin the encoded rungs' keyframes to the measured source cadence
      and disable scene-cut keyframes, so every rendition can be cut at the same instants.
- [x] 2.5 In that command, bound the bitrate of each encoded rung, and write segments and
      playlists through a temporary name so nginx never serves a half-written file.
- [x] 2.6 Have the script clear the channel's output directory before starting, so a
      manifest from a previous broadcast is never mixed with a new one.
- [x] 2.7 Have the script supervise its own ffmpeg, restarting it while the source is still
      publishing, since every rendition now comes from one process and losing it would
      otherwise end playback rather than degrade it.
- [x] 2.8 Keep the existing refusal when the source is unreachable, the process id file and
      the log line either way, since those already work and the stop script depends on them.
- [x] 2.9 Extend `scripts/vm/mtx-ladder-stop.sh` to remove the broadcast's segments and
      rendition playlists after stopping the transcoder, so a stale manifest does not
      outlive its broadcast. The per-channel master is kept, since it is written once at
      install time and the transcoder refuses to start without it. The stop also kills any
      transcode left orphaned by a supervisor that died, matched on the output directory,
      because a transcode running between broadcasts is the expensive failure here.

## 3. The lifecycle

- [x] 3.1 Extend `/usr/local/bin/mtx-live.sh` in the runbook to start the ladder in the
      background alongside the existing heartbeat, so the ladder starts when an encoder
      connects.
- [x] 3.2 Extend `/usr/local/bin/mtx-notready.sh` in the runbook to stop the ladder, so no
      transcoding happens on a machine with no broadcast.
- [x] 3.3 Have `/usr/local/bin/mtx-live.sh` add a ladder flag to the live hook's query when,
      and only when, a ladder is actually being produced, judged from the transcoder's pid
      file and the channel's master playlist, and recomputed on every heartbeat rather than
      once at go-live. A heartbeat already rewrites a live broadcast's playback address, so
      a transcoder that never starts or dies for good drops that broadcast back to the
      single-rendition address within 30 s instead of leaving it on a dead manifest.
- [x] 3.4 Remove the `owner_720` and `owner_540` path declarations from the runbook's
      `mediamtx.yml`, since nothing publishes into MediaMTX any more except the encoder.
- [x] 3.5 Have the ladder run by default, with `LADDER_ENABLED=0` in the runbook
      configuration as the way to turn it off. Default-on is safe because the flag tracks
      what is actually being produced: the failure direction is a broadcast quietly playing
      exactly as it does today, not a broadcast that does not play.

## 4. Remove the publish exception the first attempt needed

- [x] 4.1 Delete the rendition-path branch from `app/api/ingest/auth/route.ts`, so every
      MediaMTX path is once again publishable only with a stream key and the publish
      authentication carries no address-based exception.
- [x] 4.2 Delete `lib/loopback.ts` and the rendition-path helpers in `lib/renditions.ts`,
      which exist only to serve that branch.
- [x] 4.3 Delete `tests/unit/ingest-auth-rendition.test.ts`, whose subject no longer exists.
- [x] 4.4 Keep the rendition definitions themselves in `lib/renditions.ts` as the one place
      the transcoder's rungs and the master playlist's advertised numbers are both derived
      from, so the two cannot drift.

## 5. The master playlist

- [x] 5.1 Rewrite the variant addressing in `lib/master-playlist.ts` so each rendition is
      addressed as a sibling file of the master, matching the names the transcoder writes,
      and remove the warning recording that the previous approach could not work.
- [x] 5.2 Keep `scripts/vm/write-master-playlist.ts` writing that file into the channel's
      output directory, so the file on the machine is generated from the same definitions
      the tests cover rather than hand-written twice.
- [x] 5.3 Add an nginx location to the runbook serving `/ladder/<slug>/` from the output
      directory as static files, with the same public CORS treatment the existing location
      applies and no caching of playlists, leaving the existing proxy untouched at every
      other address.
- [x] 5.4 Update `tests/unit/master-playlist.test.ts` to assert the ordering, that each
      rendition address resolves relative to the master to a name the transcoder actually
      writes, and that the advertised bandwidth of each rendition exceeds its configured
      rate.

## 6. Handing viewers the ladder

- [x] 6.1 Record the master playlist as the broadcast's playback address in
      `app/api/ingest/live/route.ts` when, and only when, the live hook reports a ladder,
      covering both a new broadcast and a reconnect.
- [x] 6.2 Leave the single-rendition address as what is recorded when no ladder is reported,
      so a machine with the ladder off behaves exactly as it does today.
- [x] 6.3 Cover which address is recorded, with the flag present, with it absent, and with
      anything other than an explicit yes, and assert the single-rendition address is
      unchanged from what earlier broadcasts hold. Done against the pure `playbackAddress`
      in `tests/unit/master-playlist.test.ts` rather than a separate route test, because
      the choice is the whole of the logic and the route is one call to it.
- [x] 6.4 Confirmed by reading `worker/config.ts`: the worker builds its own address from
      its own configuration and stays on the publisher's rendition, so it is unaffected by
      whatever viewers are handed.

## 7. Prove the packaging

The thing that failed before was packaging, so the proof runs the real transcoder rather
than inspecting a manifest. It runs wherever ffmpeg is, which is the streaming machine, and
needs no MediaMTX and no browser.

- [x] 7.1 Add `scripts/vm/verify-ladder.sh` generating a synthetic 1080x1920 source at the
      production bitrate with a known keyframe interval, running the real transcoder against
      it, and failing loudly rather than reporting a pass when any assertion below does not
      hold.
- [x] 7.2 In that script, assert all three rendition playlists advance, by reading each
      twice and requiring new segments, so a rendition that is merely present but frozen
      fails.
- [x] 7.3 In that script, assert the segment boundaries of the three renditions match, which
      is the exact property the republishing approach could not deliver.
- [x] 7.4 In that script, assert the audio of each lower rendition is identical to the top
      rendition's, and that the top rendition's picture matches what was published.
- [x] 7.5 In that script, assert the master playlist advertises three renditions lowest
      first and that each advertised name is a playlist the transcoder wrote.

## 8. Land it

- [x] 8.1 Update `docs/runbooks/live-streaming-vm.md` so the overview diagram, the
      `mediamtx.yml` block, the hook scripts and the nginx block all describe the ladder as
      built, since the runbook is the deployment contract for the machine.
- [x] 8.2 Record the new latency in the runbook, replacing the stated 1–3 s with the 3–4 s
      the ladder serves and the reason it is traded, so the next reader is not told the
      machine is misbehaving when it is behaving as designed.
- [x] 8.3 Already done when the measurement was taken: the runbook's prerequisites now
      state that 2 vCPU and 4 GB is enough including the ladder, name the measured cost, and
      tell the next reader to drop to a single rung before buying cores. Checked rather than
      re-edited. `docs/architecture.md` is updated too, since its performance note described
      the machine as remux-only at 1–3 s.
- [x] 8.4 Delete `TEMP-2026-08-10-quality-ladder-handover.md`, whose only purpose was to
      carry the unanswered question that this change now answers.
- [ ] 8.5 Run `openspec validate --strict` and archive.
