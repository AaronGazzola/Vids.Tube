## Context

The whole difficulty is one number: how far into the old recording does the new
one begin?

What is known about the 8-Aug-2026 broadcast, measured rather than assumed:

- The published recording is 9,935 seconds long.
- The encoder connected at 12:18:08 and the broadcast went live at 13:03:27, so
  2,719 seconds of the file precede go-live.
- The live portion, go-live to end, is 8,508 seconds.
- 9,935 minus 8,508 is 1,427, which does not equal 2,719. The two disagree by
  about 21 minutes, so the file is neither trimmed to go-live nor a clean
  recording of the whole session.
- The live transcript's first segment starts at 3,768 seconds and its last ends
  at 9,918, so transcription began roughly an hour into the file and ran to its
  end.

Those numbers are why the offset must be measured rather than derived. Three
different timestamps imply three different answers, and at least two of them are
wrong. Any of them applied blindly would put chat minutes out, which is exactly
the defect AZ-210 was raised for.

## Goals / Non-Goals

**Goals:**
- Determine the offset from what is actually in the two files.
- Report the measurement with evidence, so it can be rejected before anything is
  written.
- Preserve the broadcast row and everything attached to it.
- Leave a repeatable procedure, since the VOD editor will need the same one.

**Non-Goals:**
- Editing video. The edited file comes from YouTube already cut.
- A general re-import. This swaps a file; it does not rebuild a broadcast.
- Handling a replacement that removes interior sections. See the risk below:
  such a replacement is detected and refused rather than mishandled.

## Decisions

**The offset is measured by aligning transcripts, not by comparing timestamps.**
Both files carry the same speech. The site holds 1,222 transcript segments
against the old file's timeline. Fetching YouTube's caption track for the edited
copy gives the same speech against the new file's timeline. The lag that best
matches one against the other is the offset, and it is derived from content that
cannot drift.

*Alternative rejected*: computing the offset from `live_at`, `started_at` and
duration. That is what the three contradictory numbers above already are, and
choosing among them is guesswork.

*Alternative rejected*: audio cross-correlation. It is more robust to bad
captions, but needs both media files locally and a signal-processing dependency,
for a problem that text alignment already solves against data mostly on hand.

**The match is scored over many segments, and the score is the confidence.**
Alignment tries a range of candidate offsets, and for each one counts how many
of the old segments find their text at the shifted position in the new
transcript. The best candidate must win by a clear margin over the
second-best, or the measurement is reported as untrustworthy and nothing is
written. A single matching landmark can be a coincidence; several hundred
agreeing on one offset cannot.

**A constant offset is asserted, not assumed.** The residual for each matched
segment is recorded. If the residuals drift across the broadcast rather than
sitting flat, the replacement is not a simple trim: something was cut from the
middle, and a single offset cannot describe it. That case is refused with the
drift reported, rather than half-applied.

**Blurring does not change duration, which is the check that this is a trim.**
The new file's duration plus the measured offset should account for the old
file's live portion. Stating that expectation up front means a violated
expectation is a caught error rather than a silent misalignment.

**A person still looks at three moments before it goes public.** The
measurement can be right and the result still wrong for a reason nobody modelled.
The dry run names three timestamps spread across the broadcast, each one a chat
message next to what was being said at that moment, so checking them is looking
rather than calculating. This is the last gate and it is cheap.

**The recording is private until the check passes.** This is why the visibility
change comes first. The swapped recording is visible to the owner, checkable by
address, and reachable by nobody else until it is confirmed.

**Everything measured against the old file is re-anchored in one transaction.**
Transcript segments, timeline spans and timeline moments all carry offsets into
the recording. Chat messages carry wall-clock times and are re-anchored by
changing what the replay measures from, not by rewriting messages.

**A snapshot is written before any change, and the command can undo itself.**
The values being rewritten are the only copy. Restoring them must not depend on
anyone having remembered the previous numbers.

## Risks / Trade-offs

- **YouTube has no caption track for the edited copy** → Measured: this video
  currently has zero caption rows, though 168 other videos have them. Captions
  appear some hours after publication and the edit may have reset them. The
  command fails with that as the reason rather than falling back to a guessed
  offset, and the fallback is to transcribe the new file locally with the
  transcriber already used for live captions.
- **The captions are poor enough that matching fails** → Reported as low
  confidence and refused. Matching is on normalised word sequences rather than
  exact strings, so ordinary transcription noise degrades the score without
  destroying it.
- **The replacement cut interior sections as well as the head** → Detected by
  residual drift and refused, with the drift reported.
- **The offset is right and the replay still looks wrong** → The three-point
  human check is the gate before the recording goes public.
- **Someone runs the old replacement script by habit** → That script deletes the
  broadcast. A note has been added to AZ-239, and this change adds a refusal to
  that script when the broadcast holds live-captured data.

## Migration Plan

- Run the dry run, read the offset, the confidence and the residual spread.
- Swap with the recording private.
- Check the three named moments.
- Make the recording public, or undo from the snapshot.

## Open Questions

None blocking. Whether YouTube's captions exist for the edited copy is a
question the dry run answers on its first run, and both answers have a path.
