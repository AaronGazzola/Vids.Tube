# Tasks: fix the recording session boundary- [x] 7.1 Deployed. The replaced version is kept on the machine as a dated backup
  in root's home, and the new script was syntax-checked there before install.
- [x] 7.2 Checked each of the 23 against R2 first, which mattered: only 12 were
  present. Those 12 were deleted, freeing 25 GB and taking the disk from 48% to
  14%. The other 11 exist ONLY on the machine, are referenced by no catalogue
  row, and date from 1-13 June 2026 while the pipeline was being built. Left in
  place pending an owner decision; 5.6 GB.
- [x] 7.4 The 11 unreferenced local-only recordings were deleted on the owner's
  decision: the full catalogue is held from YouTube, and only future broadcasts
  need to come off the machine. 5.6 GB freed.
- [x] 7.5 Machine confirmed clean: 0 files in the output directory, 0 in the
  recording directory, disk at 6% (3.9 GB of 75 GB).
- [x] 7.3 AZ-214 checked against the machine: the recording directory is empty
  and holds no stale segments. The premise was wrong, nothing is waiting to be
  concatenated onto the next broadcast, and it does not block streaming. The
  guard against it recurring is still worth having.

## 1. Read the start time from the filename

- [x] 1.1 In `scripts/vm/mtx-finalize-vod.sh`, add a helper that turns a segment
  path into an epoch by parsing the `%Y-%m-%d_%H-%M-%S-%f` timestamp out of its
  basename, and returns empty when the name does not match.
- [x] 1.2 Replace the `stat -c %W` / `%Y` block with that helper. No filesystem
  timestamp is read for timing anywhere in the script.
- [x] 1.3 Log and skip any file in the recording directory whose name does not
  parse, so a stray file cannot be given a substitute time.

## 2. Identify the broadcast from its newest segment

- [x] 2.1 Build a list of (epoch, path) pairs for every parseable segment, sorted
  oldest first.
- [x] 2.2 Request the bounds endpoint using the NEWEST segment's timestamp rather
  than the oldest, so debris from an earlier broadcast cannot select the wrong
  broadcast.
- [x] 2.3 Read `startedAt` from the response alongside the existing `liveAt` and
  `ended`. The endpoint already returns it; no app change is needed.

## 3. Partition the segments

- [x] 3.1 Split the segments into those starting at or after
  `startedAt - BOUNDARY_TOLERANCE` and those before it, with the tolerance set to
  120 seconds and defined as a named constant with a comment explaining why.
- [x] 3.2 Abort with a clear message when the current-broadcast group is empty,
  rather than publishing a recording built from debris.
- [x] 3.3 Use only the current-broadcast group for the concat list, and compute
  `TRIM` from `liveAt` minus that group's first segment's start.

## 4. Delete debris safely

- [x] 4.1 After the upload and the app notification both succeed, delete every
  segment in the debris group and log how many were removed and which broadcast
  they appeared to belong to.
- [x] 4.2 Keep the existing rule for the current broadcast's own segments: delete
  them only once the broadcast is marked ended, so a reconnect can re-finalize.
- [x] 4.3 Confirm by reading the script that no deletion can run before the
  recording has been built and published.

## 5. Verification

- [x] 5.1 Extract the filename-to-epoch parsing into a form that can be tested,
  and add `tests/unit/recording-filenames.test.ts` covering: a well-formed name
  parses to the right instant; a name with a fractional part parses; an
  unrelated filename yields nothing; a directory path with dots does not confuse
  the parse.
- [x] 5.2 Add a test for the partition: segments before the boundary are debris,
  segments after are the broadcast, and a segment inside the tolerance window is
  the broadcast.
- [x] 5.3 Run `npx tsc --noEmit`, `npm run lint` and `npx vitest run`.
- [x] 5.4 Dry-run the script logic against the segment names currently on the
  streaming machine, printing the partition it would choose, without deleting
  anything.

## 6. Stop the finalized recordings accumulating

- [x] 6.0 Delete the concatenated recording and its poster after the upload and
  the app notification both succeed. Found on the machine: 23 finalized
  recordings going back to 1-Jun-2026, 30 GB on a 75 GB disk, all already in
  R2. At about 5 GB a broadcast that was roughly six streams from filling the
  disk and failing every recording.

## 7. Deploy and clear the backlog

- [ ] 7.1 Copy the updated script to the streaming machine, keeping a copy of
  the version being replaced.
- [ ] 7.2 Delete the 23 accumulated recordings from the output directory after
  confirming each is present in R2, recording how much disk was freed.
- [x] 7.3 AZ-214 checked against the machine: the recording directory is empty
  and holds no stale segments. The premise was wrong, nothing is waiting to be
  concatenated onto the next broadcast, and it does not block streaming. The
  guard against it recurring is still worth having.
