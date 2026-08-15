# Tasks

## 1. Schema

- [x] 1.1 `npx supabase migration new add_overlay_commands`: the `chat_commands.kind` check recreated to
      admit `overlay`, `overlay_id uuid references public.overlays (id) on delete cascade`, and
      `commands jsonb not null default '[]'::jsonb` on `public.overlays`.
- [x] 1.2 Same migration: a partial index on `chat_commands (overlay_id)` where it is not null, and
      column comments saying an overlay command is an ordinary registry row the streamer still owns.
- [x] 1.3 `npx supabase db push`, then regenerate `supabase/types.ts`. Applied 15-Aug-2026.

## 2. The declaration

- [x] 2.1 `lib/overlay-commands.ts`: `parseOverlayCommands(value)` validating from unknown jsonb — a
      keyword matching the command parser's own pattern, a description, an optional non-negative cooldown
      and an optional positive limit. A malformed entry is dropped rather than thrown on.
- [x] 2.2 `tests/unit/overlay-commands.test.ts`: 8 cases. A good declaration parses with and without its
      limits; an uppercase keyword, a punctuated keyword, an empty keyword and a leading `!` are dropped;
      a missing description is dropped; a duplicate does not let the second win; a nonsense cooldown or
      limit is dropped while keeping the command; a non-list reads as none.

## 3. Registering and withdrawing

- [x] 3.1 `installOverlayAction` inserts the declared commands with `kind: 'overlay'` and `overlay_id`,
      skipping any keyword the channel already uses and returning the skipped keywords. An overlay must
      not be able to take `!help` away from the channel that owns it.
- [x] 3.2 `removeOverlayAction` deletes that overlay's commands before removing the installation. In that
      order: a row left behind would execute for an overlay that is no longer there.
- [x] 3.3 `useInstallOverlay` raises a toast naming any skipped keyword. A command that silently did not
      appear is worse than one that never existed, because the chatters would be typing it.

## 4. The worker

- [x] 4.1 `worker/lib/commands.ts`: `if (row.kind === "overlay") continue;` after the execution is
      logged, with a comment saying the logged row is the delivery. Explicit rather than relying on the
      existing fall-through, which does the same thing only by accident.
- [x] 4.2 Confirmed by reading: the enable switch, the cooldown and the per-stream limit are all
      evaluated above this branch, so an overlay command is governed exactly as any other. The
      `chat-commands` end-to-end spec still passes.

## 5. Reading events

- [x] 5.1 `lib/overlay-events.ts`: `overlayEventsFor(...)` selecting executed `command_events` whose
      keyword belongs to that overlay on that channel, joined to `chat_messages` for the display name,
      with `actor` derived through `opaqueSubject` from the participant key.
- [x] 5.2 `app/api/overlay/events/route.ts`: a `GET` taking the bearer token and a `since` parameter,
      verifying as the settings endpoint does, capped at 50, with the same single refusal and the same
      cross-origin handling.
- [x] 5.3 A caller with no cursor, or one reaching further back than a minute, is given the last minute
      only. An overlay replaying an hour of feeding on load is worse than missing it.

## 6. Delivery to the frame

- [x] 6.1 `lib/overlay-messages.ts`: an `event` message carrying one event, and its parse case.
- [x] 6.2 `useOverlayEvents(token)` polls the endpoint every two seconds once an installation exists,
      holding the cursor in memory so a reload starts from the reload.
- [x] 6.3 `use-overlay-conversation.ts` sends each event once the frame has announced itself, in order,
      tracked by id rather than by timestamp so a re-run effect cannot deliver a chatter's action twice.
      The id set is pruned, because a stream runs for hours.
- [x] 6.4 `public/overlay-sdk.js`: `onEvent`, and a protocol header describing the event shape and saying
      plainly that `actor` is keyable and `actorName` is not.
- [x] 6.5 `tests/unit/overlay-sdk.test.ts` and `overlay-messages.test.ts`: an event round trips through
      the protocol; the SDK delivers one to a subscriber, does **not** replay one to a late subscriber
      because an event is a thing that happened, and ignores an event message carrying no event.

## 7. Verify

- [x] 7.1 `scripts/check-overlay-events.ts`, run against the remote database. Five checks, all passing:
      the same chatter is the same actor to one overlay on one channel; a different actor to another
      overlay; a different actor on another channel; the participant key is not recoverable from the
      actor; and the registry admits an overlay-kind command.
- [x] 7.2 `tests/e2e/overlay-events.spec.ts`: with the intercepted frame loading the real SDK, an
      execution inserted for the installed overlay reaches the frame carrying its keyword, arguments and
      an opaque actor; it is still exactly one event several polls later; a second execution arrives; and
      the frame's `src` is unchanged throughout, so all of it happened while the overlay was running.
- [x] 7.3 `npx tsc --noEmit` clean, `npx eslint` clean over every changed file, 666 unit tests pass across
      56 files, and `npm run build:local` completes.
- [x] 7.4 The chat command end-to-end spec passes alongside the overlay specs: ten cases across
      `overlay-message-channel`, `overlay-settings`, `game-window` and `chat-commands`.
