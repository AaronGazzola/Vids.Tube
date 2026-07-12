## Why

A dated `scheduled` broadcast is public before go-live, and the owner wants the
audience to gather on a **waiting room** page: a countdown plus a live chat they can
post in while they wait, with the same moderation and (optional) scoring as the live
show. Today the public channel only renders a static coming-soon card and chat is
scoped to `live`. The owner also needs guardrails when scheduling: because the
waiting-room chat and YouTube-chat merge depend on the local worker running and a
YouTube URL being set, saving a schedule should warn when those are missing, and
should confirm that scheduling makes a public page (and public chat) appear.

## What Changes

- **Waiting-room chat setting** — a per-stream toggle `waiting_room_chat` on the
  active broadcast. When on, the scheduled waiting room has an active chat; when off,
  the waiting room shows only the countdown.
- **Waiting room page** — for a public dated broadcast (`scheduled`, or its `preview`
  while the audience still waits), the channel surface shows a countdown, a
  **waiting count** (present viewers), and, when `waiting_room_chat` is on, the live
  chat. Full chat + moderation + scoring (per their settings) apply during the wait,
  driven by the worker (see `run-worker-through-prelive`). At go-live the same page
  swaps the countdown for the live player, keeping the same chat.
- **Chat active pre-live** — chat read/post is available for a public
  `scheduled`/`preview` stream (waiting room), not only `live`, scoped to that
  stream's session, gated by `waiting_room_chat`.
- **Schedule-save validation** — when the owner saves with a `scheduled_start_at`
  set, the app polls worker availability (heartbeat) and checks the YouTube URL. If
  the worker is not running, or the YouTube URL is missing, a confirmation dialog
  lists what is missing, explains the effect (no moderation during the wait; no
  YouTube chat merged), and offers **Schedule anyway** or **Fix first**.
- **First-time-schedule confirmation** — when saving newly adds a datetime (the
  broadcast had none before), a confirmation explains that a public scheduled page
  will be shown, and — if `waiting_room_chat` is on — that the chat will be public.

## Capabilities

### Modified Capabilities

- `scheduled-broadcasts`: adds the `waiting_room_chat` setting, the schedule-save
  validation, and the first-time-schedule confirmation.
- `live-chat`: chat read/post available in the public `scheduled`/`preview` waiting
  room (gated by `waiting_room_chat`), not just `live`.
- `channel-live`: the public channel renders a waiting room (countdown + waiting
  count + optional chat) for a dated pre-live broadcast, transitioning to the live
  player at go-live.

## Impact

- Migration: `streams.waiting_room_chat boolean not null default false` (or
  channel-level default copied onto the active stream).
- Public channel query/page: render the waiting room per the `isStreamPublic` rule
  from `redesign-stream-lifecycle`; reuse presence (see `viewer-cap`) for the waiting
  count.
- Chat action/RLS: allow posting to a `scheduled`/`preview` stream when
  `waiting_room_chat` is on and the stream is public.
- The save-validation and confirmation dialogs live in the `/live` Settings tab
  (`unify-live-stream-page`) but the rules are specified here.
- Depends on `redesign-stream-lifecycle` (public rule, statuses) and
  `run-worker-through-prelive` (worker engages scheduled + heartbeat).
