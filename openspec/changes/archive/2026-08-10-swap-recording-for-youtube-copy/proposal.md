## Why

The 8-Aug-2026 broadcast's recording shows an email address on screen. The
YouTube copy has been edited to blur it. The site should serve that edited copy.

Everything else about the broadcast is sound and must survive: 103 chat
messages, 1,222 transcript segments, the scoring, and the memberships, credits
and badges that followed from it. The existing replacement script cannot be used
here, because it deletes the broadcast row and expects the YouTube copy to be
imported as a new broadcast. That was right for three broadcasts on 2-Aug-2026
that held no live-captured data. It would destroy this one.

So this is a file swap, not a re-import. The only thing wrong with the broadcast
is the video.

## What Changes

- A command that swaps the file behind an existing recording: download the
  YouTube copy, upload it to storage, and point the existing row at it, leaving
  the broadcast and everything hanging off it untouched.
- **A measured alignment step, which is the substance of this change.** The two
  files do not start at the same moment: the current recording runs 9,935
  seconds while the live portion is 8,508, so roughly 24 minutes of pre-live
  footage sits in the published file. Chat replay and the timeline are both
  measured against the recording, so swapping the file without correcting the
  offset would leave chat about 24 minutes out.
- The offset SHALL be measured from the content of the two files rather than
  computed from timestamps, and the measurement SHALL be reported with enough
  evidence to be trusted or rejected before anything is written.
- A dry run that reports the measured offset, its confidence and the three
  moments a person should spot-check, and writes nothing.
- Re-anchoring of every timing that refers to the recording: chat replay
  offsets, transcript segments, timeline spans and moments.
- The recording stays private until the alignment has been confirmed, and is
  made public afterwards.

## Capabilities

### New Capabilities
- `recording-swap`: replacing the file behind an existing recording, measuring
  the offset between old and new, proving the alignment, and re-anchoring
  everything measured against the old file.

### Modified Capabilities

## Impact

- Depends on `vod-visibility`, which supplies the private state the recording
  sits in while being checked.
- Touches the recording row, the transcript segments, and the timeline spans and
  moments for one broadcast. Does not touch chat messages, which carry wall-clock
  times and are re-anchored by the replay offset rather than rewritten.
- Reusable beyond this broadcast: the same measurement is what the VOD editor
  (AZ-190) will need whenever a published recording is re-cut.
- AZ-239 is the tracking issue. AZ-236 is closed by the result.
