## 1. Getting the replacement transcript

- [x] 1.1 Add `lib/transcript-align.ts`, pure and testable, with no database or network access, so the alignment can be proven without a broadcast.
- [x] 1.2 In it, add `normaliseWords(text)`: lower-case, strip punctuation, collapse whitespace, return a word array, so ordinary transcription differences do not defeat matching.
- [x] 1.3 Extend `scripts/backfill-youtube-transcripts.ts` usage to fetch the caption track for one video on demand, since this video currently has none while 168 others do.
- [x] 1.4 Dropped, deliberately. The fallback was never exercised: captions exist for this video and for 168 others, so the local-transcription path would have shipped untested for a case that has not occurred. The command instead fails naming the missing caption track, which is the behaviour the specification actually requires, and the fallback can be added the first time it is needed.

## 2. Measuring the offset

- [x] 2.1 Add `alignByLag(oldSegments, newSegments, range)` to `lib/transcript-align.ts`, returning `{ offsetS, matched, runnerUpMatched, residuals }`.
- [x] 2.2 Score a candidate lag by counting old segments whose normalised words are found in the new transcript within a small window of the shifted position, so the score is a count of agreements rather than a similarity average.
- [x] 2.3 Search candidate lags coarsely first, then refine around the best, so the whole plausible range is covered without scanning it at full resolution.
- [x] 2.4 Return the runner-up's score alongside the winner's, since the margin between them is the confidence.
- [x] 2.5 Record a residual per matched segment, so drift can be tested for rather than assumed absent.
- [x] 2.6 Add `residualDrift(residuals)` returning the slope across the broadcast, the spread at the 90th percentile, and the position where drift first exceeds tolerance. Spread is measured at a percentile rather than at the worst point: on the real broadcast a single outlier among 1,001 agreements failed an earlier maximum-based rule, which was a false refusal.

## 3. Proving the alignment logic

- [x] 3.1 Add `tests/unit/transcript-align.test.ts` building a synthetic transcript, shifting it by a known offset, and asserting the measured offset matches.
- [x] 3.2 Assert a match survives transcription noise: words dropped, words substituted, and segment boundaries moved.
- [x] 3.3 Assert two unrelated transcripts produce no confident winner, so the refusal path is exercised rather than assumed.
- [x] 3.4 Corrected during implementation: an interior cut produces two clusters rather than a slope, so it is caught by the confidence margin rather than by the drift slope. The test asserts the refusal, and a separate test covers genuine gradual drift. Both mechanisms are required to pass and they cover different failures, which is now stated in the code.
- [x] 3.5 Assert the measured offset is exact on a clean shift, so the tolerance is not hiding an error.

## 4. The swap command

- [x] 4.1 Add `scripts/swap-recording.ts` taking `--stream`, defaulting to a dry run and writing only with `--apply`.
- [x] 4.2 Report the measured offset, the matched count, the runner-up count, the residual spread, and which transcript source was used.
- [x] 4.3 Check that the replacement's duration plus the offset accounts for the original live portion, and fail the run when it does not, showing both numbers.
- [x] 4.4 Print three moments spread across the broadcast, each pairing a chat message with the transcript text expected at that position in the replacement.
- [x] 4.5 Write a snapshot of every value about to change, under the snapshot directory, before writing anything.
- [x] 4.6 Download the YouTube copy, upload it to storage beside the existing recording rather than over it, so the original file survives an undo.
- [x] 4.7 Point the recording at the new file and record its duration, leaving the broadcast row untouched. Dimensions are not rewritten: blurring does not change the frame size, and the recorded dimensions are already correct.
- [x] 4.8 Shift transcript segments, timeline spans and timeline moments by the measured offset, in one transaction with the recording update.
- [x] 4.9 Leave chat message rows untouched, since they carry wall-clock times.
- [x] 4.10 Leave the recording private on apply, so the check happens before anyone else can reach it.
- [x] 4.11 Add `--undo` restoring every value from the snapshot, including the previous file.

## 5. Closing the destructive path

- [x] 5.1 Make `scripts/replace-site-recordings.ts` refuse any broadcast holding live-captured chat, naming the counts it would have destroyed and pointing at this command instead.
- [x] 5.2 Add a unit test for that refusal, so the guard cannot be removed silently.

## 6. Running it

- [x] 6.0 Unplanned and required: chat replay anchored on go-live and assumed the file began there. That is already wrong for this broadcast by about 45 minutes, and the swap would have added another 48 seconds. Recordings now carry `starts_at`, the wall-clock instant their file begins, and replay prefers it over go-live. Null preserves today's behaviour for every existing recording. Covered by three cases in the chat replay tests.

- [x] 6.1 Run the dry run against the 8-Aug-2026 broadcast and record the measured offset and confidence in AZ-239.
- [x] 6.2 Applied 10-Aug-2026, at an offset of 2,671 seconds. The first attempt half-applied and was restored from its snapshot; the cause was a non-transactional loop and is fixed. 1,222 transcript segments shifted, no spans or moments on this broadcast.
- [x] 6.3 Confirmed against production. Unchanged: 103 chat messages, 1,222 transcript segments, 3 membership records, 1 credit entry. Changed as intended: the transcript now runs 1,097s to 7,247s, the recording is 7,264s and points at the replacement, and its file start is recorded as 13:02:39. Both files are served by the CDN, so an undo has something to return to.

Looking at the three moments and deciding to publish are the owner's, not code,
so they live in AZ-239 with the measurement and the three timestamps rather than
as boxes here.
