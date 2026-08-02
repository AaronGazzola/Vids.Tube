# Tasks: fix the recording session boundary

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

## 6. Deploy and clear the backlog

- [ ] 6.1 Copy the updated script to the streaming machine and confirm the hook
  still runs by checking the MediaMTX unit's log for a finalize.
- [ ] 6.2 Clear the stale 28-Jul-2026 segments (AZ-214), recording how many files
  and how much disk were freed.
- [ ] 6.3 Confirm the recording directory holds nothing older than the most
  recent broadcast.
