# Tasks

## 1. The status itself

- [x] 1.1 Add `canceled` to `TASK_STATUSES` in `lib/stream-tasks.ts`, after `completed`. The tuple is the
      cycle order, so its position is the whole of the cycle change.
- [x] 1.2 In `app/(app)/live/tasks.actions.ts`, exclude `canceled` as well as `completed` from the tasks
      carried over from the previous broadcast. Dropped work is not unfinished work.

## 2. The editor

- [x] 2.1 In `app/(app)/live/task-list-editor.tsx`, give `canceled` a label, a cross icon and a colour of
      its own in the three status maps.
- [x] 2.2 Move the strikethrough from `completed` to `canceled`, so a completed task is marked by its tick
      alone.

## 3. The overlay reveal

- [x] 3.1 In `components/overlay/task-list-card.tsx`, draw a cross for `canceled` beside the existing
      tick, both always mounted and faded between, so a task going from completed to canceled swaps one
      mark for the other rather than popping.
- [x] 3.2 Give the canceled box its own border and fill, matching how the completed box is drawn.
- [x] 3.3 Strike through canceled text and stop striking through completed text.

## 4. Cover it

- [x] 4.1 Update the cycle test in `tests/unit/stream-tasks.test.ts` to run through all five statuses and
      wrap at `canceled`.
- [x] 4.2 `tests/unit/task-list-editor.test.tsx`: the cycle reaches all five, and a canceled row is struck
      through while a completed row is not.
- [x] 4.3 `tests/unit/task-list-card.test.tsx`: after the change moment a canceled task shows its cross
      and not its tick and is struck through, and a completed task shows its tick and is not.

## 5. Land it

- [x] 5.1 `npx tsc --noEmit` and
      `NODE_OPTIONS=--experimental-require-module doppler run -- npx vitest run`.
- [x] 5.2 Run `openspec validate --strict` and archive.
