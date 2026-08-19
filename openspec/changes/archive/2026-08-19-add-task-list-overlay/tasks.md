# Tasks

## 1. Reading the list from the overlay

- [x] 1.1 `npx supabase migration new stream_task_versions_live_read`. Add one select policy on
      `stream_task_versions` that is true while the broadcast the row belongs to has status `live`,
      mirroring how a greeting is readable while its broadcast is live and closed the moment it ends.
      Leave the owner policies from `add-broadcast-task-list` untouched.
- [x] 1.2 `npx supabase db push`, then `npm run db:types`.
- [x] 1.3 In `app/(overlay)/overlay/[channelSlug]/page.actions.ts`, read task versions with the ordinary
      row-level-security-bound client. Do not add a `supabaseAdmin` call site: the policy in 1.1 is the
      authorization, and the overlay token gate stays exactly as it is for the rest of the route.

## 2. Working out what changed

- [x] 2.1 In `lib/stream-tasks.ts`, add `diffTaskLists(previous, next)` returning one entry per task in
      the next list, marked `unchanged`, `added`, or `status` with the status it moved from and to, plus
      the tasks present in the previous list and absent from the next, marked `removed`. Match tasks by
      identifier, never by wording, so editing wording is not read as a removal and an addition.
- [x] 2.2 A reveal with no previous state, which is the first save of a broadcast, marks every task
      `added`.
- [x] 2.3 Extend `tests/unit/stream-tasks.test.ts`: a status change is reported with both statuses; an
      edited wording on an unchanged status is reported as unchanged; an added task and a removed task
      are each reported once; reordering alone reports every task unchanged.

## 3. The reveal card

- [x] 3.1 New `components/overlay/task-list-card.tsx` taking the previous list, the next list and an
      `onDone` callback, in the shape the other cards drawn through the shared slot already use.
- [x] 3.2 Draw the previous state first, then apply every difference at one moment, then hold the new
      state, then fade out and call `onDone`. Keep the four durations as named constants at the top of
      the file so the pacing can be tuned in one place.
- [x] 3.3 Every difference animates together, not one after another: a checkmark drawn into an empty box,
      a completed task struck through, an added task appearing, a task changing status in place.
- [x] 3.4 Write the keyframes with `0%` and `100%` stops. The CSS build silently discards `from` and `to`
      keyframes, so an animation written that way never runs.
- [x] 3.5 A reveal with nothing to animate, which is what the show-in-overlay button produces, draws the
      list, holds it and fades. It must not look broken for want of a change.
- [x] 3.6 Draw a long list within the slot's width without overflowing it, breaking long wording the way
      the other cards do.

## 4. Putting it on the overlay

- [x] 4.1 Add `tasks` to `DemoOverlayKey` in `app/(app)/live/demo.types.ts` and to the default visibility
      map, alongside `tts`, `ask` and `welcome`, which already share the feed slot without owning a box.
      Add the toggle to the Overlays tab beside those three.
- [x] 4.2 Include `tasks` in the `feedVisible` calculation in
      `app/(overlay)/overlay/[channelSlug]/page.tsx`, so enabling the reveal alone is enough for the slot
      to be drawn.
- [x] 4.3 In `LiveFeedSlot`, hold the version the overlay last showed. Seed it at load with the newest
      version of the broadcast, so refreshing the browser source mid-broadcast replays nothing.
- [x] 4.4 Poll for the newest version on the interval the neighbouring overlay queries already use. When
      the newest version is not the one last shown, reveal from the last shown list to the newest list,
      and record the newest as last shown when the card is done. Two saves during one reveal therefore
      collapse into a single following reveal covering both.
- [x] 4.5 Rank the reveal last in the slot's existing precedence, after the highlight, spoken message,
      question and welcome. A reveal waits for the slot rather than interrupting what is on screen. Mark
      it with a `ponytail:` comment naming the ceiling: during continuous chat a reveal can be held back
      for as long as the slot stays busy.
- [x] 4.6 Add the reveal to the simulated overlay in `app/(app)/live/overlays-demo.tsx` so the Overlays
      tab can be positioned and previewed without a live broadcast, and extend the stage parity test that
      covers the other slot cards.

## 5. Showing it on demand

- [x] 5.1 In `app/(app)/live/tasks.actions.ts`, add `revealStreamTasksAction(streamId)` writing a version
      whose items are the newest saved items and whose reason is `requested`. It writes the saved list,
      never the draft, so an unsaved edit cannot reach the audience.
- [x] 5.2 When the broadcast has no saved list, return an expected error saying there is nothing to show
      rather than writing an empty version.
- [x] 5.3 Add the show-in-overlay button to the bottom left of the Activity tab popover, opposite Save.
      Leave Save at the bottom right.
- [x] 5.4 Disable the button while the draft differs from the saved list, and say that saving comes
      first. Otherwise pressing it shows the audience a list the owner has already moved on from.

## 6. Cover it

- [x] 6.1 `tests/unit/task-list-card.test.tsx`: the card opens on the previous state; after the change
      moment every difference is applied; a reveal with no differences still draws the list and calls
      `onDone`.
- [x] 6.2 A test that the slot reveals nothing for a version that was already the newest at load, which
      is the browser-source refresh case.
- [x] 6.3 A test that two new versions arriving while a reveal is on screen produce one further reveal,
      from the state last shown to the newest state.
- [x] 6.4 A test that a reveal does not displace a highlight, spoken message, question or welcome holding
      the slot.

## 7. Land it

- [x] 7.1 `npx tsc --noEmit`, `npm run lint`, and
      `NODE_OPTIONS=--experimental-require-module doppler run -- npx vitest run`.
- [x] 7.2 `npm run rls-check`, confirming a live broadcast's task versions are readable by a visitor and
      that the same rows stop being readable once the broadcast has ended.
- [x] 7.3 Run `openspec validate --strict` and archive.

## 8. Done differently from as written

- 3.2 and 3.4: no new keyframes were written. The card rides the shared `highlight-pop` envelope every
  other card in the slot uses, and the change moment is a state flip driving CSS transitions. Two
  constants (open, hold) rather than four, and nothing for the from/to keyframe trap to catch.
- 4.2: the live slot is handed the saved configuration's visibility rather than the snapshot's, because
  the demo snapshot broadcast to OBS carries no task reveal and the live slot never renders in demo mode.
- 4.6: the stage parity test needed no change. The reveal shares the feed slot instead of owning a box, so
  it is not one of the boxes that test compares. The simulated reveal is shown in the Overlays tab
  composer and is deliberately not carried in the demo-to-OBS snapshot.
- 6.2, 6.3 and 6.4: the slot's decision — when to reveal, from which state, and never while the slot is
  busy — was extracted as `taskRevealFor` and tested there, rather than mounting the whole overlay with
  every one of its queries mocked. The component now reads that one call.
- A removed task is drawn at the end of the list during the reveal rather than in the position it held.
  Removing a task is rare next to completing one, and holding its old index would mean merging two
  orderings for the few seconds a reveal lasts.
