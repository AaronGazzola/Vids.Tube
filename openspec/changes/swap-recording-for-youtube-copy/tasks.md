## 1. Getting the replacement transcript

- [ ] 1.1 Add `lib/transcript-align.ts`, pure and testable, with no database or network access, so the alignment can be proven without a broadcast.
- [ ] 1.2 In it, add `normaliseWords(text)`: lower-case, strip punctuation, collapse whitespace, return a word array, so ordinary transcription differences do not defeat matching.
- [ ] 1.3 Extend `scripts/backfill-youtube-transcripts.ts` usage to fetch the caption track for one video on demand, since this video currently has none while 168 others do.
- [ ] 1.4 When no caption track exists, fall back to transcribing the replacement locally with the same transcriber used for live captions, and record which source was used in the report.

## 2. Measuring the offset

- [ ] 2.1 Add `alignByLag(oldSegments, newSegments, range)` to `lib/transcript-align.ts`, returning `{ offsetS, matched, runnerUpMatched, residuals }`.
- [ ] 2.2 Score a candidate lag by counting old segments whose normalised words are found in the new transcript within a small window of the shifted position, so the score is a count of agreements rather than a similarity average.
- [ ] 2.3 Search candidate lags coarsely first, then refine around the best, so the whole plausible range is covered without scanning it at full resolution.
- [ ] 2.4 Return the runner-up's score alongside the winner's, since the margin between them is the confidence.
- [ ] 2.5 Record a residual per matched segment, so drift can be tested for rather than assumed absent.
- [ ] 2.6 Add `residualDrift(residuals)` returning the slope across the broadcast and the position where drift first exceeds tolerance.

## 3. Proving the alignment logic

- [ ] 3.1 Add `tests/unit/transcript-align.test.ts` building a synthetic transcript, shifting it by a known offset, and asserting the measured offset matches.
- [ ] 3.2 Assert a match survives transcription noise: words dropped, words substituted, and segment boundaries moved.
- [ ] 3.3 Assert two unrelated transcripts produce no confident winner, so the refusal path is exercised rather than assumed.
- [ ] 3.4 Assert a transcript with an interior section removed produces drifting residuals and is reported as drift rather than as a single offset.
- [ ] 3.5 Assert the measured offset is exact on a clean shift, so the tolerance is not hiding an error.

## 4. The swap command

- [ ] 4.1 Add `scripts/swap-recording.ts` taking `--stream`, defaulting to a dry run and writing only with `--apply`.
- [ ] 4.2 Report the measured offset, the matched count, the runner-up count, the residual spread, and which transcript source was used.
- [ ] 4.3 Check that the replacement's duration plus the offset accounts for the original live portion, and fail the run when it does not, showing both numbers.
- [ ] 4.4 Print three moments spread across the broadcast, each pairing a chat message with the transcript text expected at that position in the replacement.
- [ ] 4.5 Write a snapshot of every value about to change, under the snapshot directory, before writing anything.
- [ ] 4.6 Download the YouTube copy, upload it to storage beside the existing recording rather than over it, so the original file survives an undo.
- [ ] 4.7 Point the recording at the new file and record its duration and dimensions, leaving the broadcast row untouched.
- [ ] 4.8 Shift transcript segments, timeline spans and timeline moments by the measured offset, in one transaction with the recording update.
- [ ] 4.9 Leave chat message rows untouched, since they carry wall-clock times.
- [ ] 4.10 Leave the recording private on apply, so the check happens before anyone else can reach it.
- [ ] 4.11 Add `--undo` restoring every value from the snapshot, including the previous file.

## 5. Closing the destructive path

- [ ] 5.1 Make `scripts/replace-site-recordings.ts` refuse any broadcast holding live-captured chat, naming the counts it would have destroyed and pointing at this command instead.
- [ ] 5.2 Add a unit test for that refusal, so the guard cannot be removed silently.

## 6. Running it

- [ ] 6.1 Run the dry run against the 8-Aug-2026 broadcast and record the measured offset and confidence in AZ-239.
- [ ] 6.2 Apply the swap, leaving the recording private.
- [ ] 6.3 Confirm afterwards that the chat message count, transcript count, membership stats and credit entries are unchanged.
- [ ] 6.4 Check the three named moments in the browser and record the result in AZ-239.
- [ ] 6.5 Make the recording public, and close AZ-236 and AZ-239.
