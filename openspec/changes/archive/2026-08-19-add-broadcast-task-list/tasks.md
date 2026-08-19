# Tasks

## 1. Storage

- [x] 1.1 `npx supabase migration new stream_task_versions`. In the generated file create
      `stream_task_versions`: `id uuid primary key default gen_random_uuid()`, `stream_id uuid not null
      references streams(id) on delete cascade`, `channel_id uuid not null references channels(id) on
      delete cascade`, `items jsonb not null default '[]'::jsonb`, `reason text not null default 'saved'
      check (reason in ('saved','requested'))`, `created_at timestamptz not null default now()`, plus an
      index on `(stream_id, created_at desc)` because every read is "the newest version of this
      broadcast". Do not add a per-task table: a version is written whole and never edited.
- [x] 1.2 `reason` is written now and read only by `add-task-list-overlay`. It is in this migration
      rather than a later one so the column exists before any version row is written.
- [x] 1.3 Enable row-level security on the table with one policy for select and one for insert, each
      true when the row's `channel_id` belongs to a channel whose `owner_user_id` is `auth.uid()`. Write
      no update and no delete policy: a version is append-only and a mistake is corrected by saving
      again. Viewer and overlay read access is added by the changes that need it, not here.
- [x] 1.4 `npx supabase db push`, then `npm run db:types`.

## 2. The list rules, as plain functions

- [x] 2.1 New `lib/stream-tasks.ts`. Export `TASK_STATUSES` as the ordered tuple `backlog`, `todo`,
      `in_progress`, `completed`, and `StreamTask = { id: string; text: string; status: TaskStatus }`.
      The order of the tuple is the cycle order used in 2.2, so the two cannot drift apart.
- [x] 2.2 `nextTaskStatus(status)`: the next entry in `TASK_STATUSES`, wrapping from `completed` back to
      `backlog`.
- [x] 2.3 `trimTaskDraft(list)`: while the list has at least two rows and both of the last two have blank
      text, drop the last row. A blank row elsewhere in the list is left alone, because only the bottom
      of the list is being kept tidy.
- [x] 2.4 `canAddTask(list)`: true when the list is empty or the last row's text is not blank. This is
      what hides the add button rather than disabling it.
- [x] 2.5 `taskDraftToSaved(list)`: drop every row whose text is blank, trim the remaining text, and
      return the rows in list order. This is what gets written; the draft's trailing empty row never
      reaches the table.
- [x] 2.6 `tests/unit/stream-tasks.test.ts` covering: the status cycle wrapping at `completed`; two
      trailing blank rows becoming one; a single trailing blank row surviving; a blank row in the middle
      surviving; the add button hidden for a blank last row and shown for a filled one; a blank row
      dropped on save.

## 3. Reading and writing

- [x] 3.1 New `app/(app)/live/tasks.actions.ts`. Every action uses the row-level-security-bound server
      client from `@/supabase/server-client`. Do not import `supabaseAdmin` here: authorization is the
      policy written in 1.3.
- [x] 3.2 `getStreamTasksAction(streamId)`: the `items` of the newest version for that broadcast, or an
      empty list when the broadcast has none. A query action, so it throws on failure and returns an
      empty list for absence.
- [x] 3.3 `saveStreamTasksAction(streamId, items)`: returns `ActionResult`. Compare the incoming items
      with the newest version's items and insert nothing when they are identical. This is what stops a
      Save press with no edits from writing a version, and `add-task-list-overlay` depends on it to
      avoid revealing an unchanged list.
- [x] 3.4 `getPreviousBroadcastTasksAction(streamId)`: the items whose status is not `completed`, taken
      from the newest version of the channel's most recent broadcast that started before this one.
      Returns an empty list when there is no earlier broadcast or it saved no tasks. Give each returned
      item a fresh identifier, because a carried item is a new task rather than the same one.
- [x] 3.5 New `app/(app)/live/tasks.hooks.tsx`: a query hook per read action and a mutation hook wrapping
      the save, unwrapping `ActionResult` into a thrown error the way the other mutation hooks in this
      directory do. Invalidate the tasks query on success.

## 4. One draft, two surfaces

- [x] 4.1 New `app/(app)/live/tasks.stores.ts` holding the draft: the broadcast the draft belongs to, the
      rows, and setters for replacing a row, moving a row, adding a row and clearing the draft. Keep the
      broadcast id in the store and reseed the draft when it changes, so switching broadcast cannot save
      one broadcast's list onto another.
- [x] 4.2 Seed the draft from `getStreamTasksAction` on first load of a broadcast and leave it alone on
      later refetches, matching how the Settings form guards in-progress edits against a background
      refetch.
- [x] 4.3 Give a new row its identifier with `crypto.randomUUID()` at the moment the row is added, so the
      identifier survives into the saved version and the overlay can match a row across two versions.
- [x] 4.4 New `app/(app)/live/task-list-editor.tsx` rendering the rows, used unchanged by both surfaces.
      It reads the draft from the store and renders per row: a drag handle, a one-row `Textarea` (not
      `Input`), and the status button. It renders the add button under the list. It renders no Save
      control: each surface supplies its own.
- [x] 4.5 The status button shows the current status through its icon and colour and advances with
      `nextTaskStatus` on press. Give it an accessible label naming the current status, since the icon
      alone carries the meaning.
- [x] 4.6 Reorder with native browser drag events: a row becomes draggable only while its handle is under
      the pointer, and the drop position is the row the pointer is over. Do not add a drag-and-drop
      package. Mark the limitation with a `ponytail:` comment naming the ceiling: native drag events do
      not fire for touch, and the up and down arrow buttons used by the overlay messages list are the
      fallback if that becomes a problem.
- [x] 4.7 Run the rows through `trimTaskDraft` after every edit before storing them, so "at most one
      empty row at the bottom" holds continuously rather than only at save time.

## 5. The Settings tab section

- [x] 5.1 Add a tasks section to `app/(app)/live/settings-tab.tsx` using the existing `Section` wrapper,
      rendering the shared editor.
- [x] 5.2 Join the existing Save changes press: extend the `dirty` computation in
      `app/(app)/live/page.tsx` so a task draft differing from the saved list marks the tab dirty, and
      call the save mutation from `doSave` alongside the existing message commit. Save changes stays the
      only writer, exactly as it is for a staged thumbnail and for overlay messages.
- [x] 5.3 Add the populate button to the section, calling `getPreviousBroadcastTasksAction` and appending
      the returned rows to the draft. Show a line stating that nothing is saved until Save changes is
      pressed, matching the wording already used under the overlay messages list.
- [x] 5.4 When the previous broadcast has no unfinished tasks, say so rather than leaving the press
      looking broken.
- [x] 5.5 Leave `ReuseSettingsDialog` untouched, and add a line to the comment above it recording that
      reusing a broadcast deliberately copies no tasks.

## 6. The Activity tab popover

- [x] 6.1 Add a checkbox icon button to `ActivityIndicators` in `app/(app)/live/panels.tsx`, beside the
      existing indicators, opening a `Popover` holding the shared editor.
- [x] 6.2 Put Save at the bottom right of the popover, calling the same save mutation as the Settings
      tab. Nothing typed, toggled or dragged in the popover is written until Save is pressed.
- [x] 6.3 Leave the bottom left of the popover empty in this change. `add-task-list-overlay` puts the
      show-in-overlay button there.
- [x] 6.4 Render no button when there is no active broadcast, matching the rest of the Activity tab
      header.

## 7. Cover it

- [x] 7.1 `tests/unit/task-list-editor.test.tsx`: a blank last row hides the add button; filling it shows
      the button; the status button advances through all four statuses and back; a row renders a text
      area rather than an input.
- [x] 7.2 A test that Save writes what `taskDraftToSaved` returns rather than the raw draft, so the
      trailing blank row is not saved.
- [x] 7.3 A test that a save whose items match the newest version inserts no row.

## 8. Land it

- [x] 8.1 `npx tsc --noEmit`, `npm run lint`, and
      `NODE_OPTIONS=--experimental-require-module doppler run -- npx vitest run`.
- [x] 8.2 `npm run rls-check`, confirming the new table is unreadable by a signed-out client and by a
      signed-in non-owner.
- [x] 8.3 Run `openspec validate --strict` and archive.

## 9. Done differently from as written

- 4.4: no per-row delete control was added. Clearing a row's wording is what removes the task, since a
  blank row is dropped on save and the trailing-blank rule already collapses it. A delete button would be
  a second way to do the same thing, and nothing asked for one.
- 7.3: covered as a unit test of `sameTaskList`, the comparison the action makes, rather than by writing
  to Supabase from a test. The action's guard is that one call, and the repo has no fixture for exercising
  a Server Action against the remote database.
- The pre-existing typecheck failure in `scripts/clear-host-scores.ts` was fixed on the way past, because
  8.1 could not otherwise pass. The loop over three tables and their differing columns is written out.
