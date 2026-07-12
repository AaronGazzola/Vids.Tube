## Context

- Public visibility comes from `redesign-stream-lifecycle`:
  `(scheduled_start_at IS NOT NULL AND status IN ('scheduled','preview')) OR status = 'live'`.
- Worker engages public streams and heartbeats (`run-worker-through-prelive`).
- `live-chat` already has public read, authenticated post, per-session scoping, and
  RLS insert-integrity; today scoped to the live session.
- `channel-live` renders the channel's live state; `scheduled-broadcasts` renders a
  coming-soon card. The home page redirects to `/{slug}/live` when live.
- `viewer-cap` tracks presence via Supabase Realtime presence channels.

## Decisions

### Waiting-room chat setting

`streams.waiting_room_chat boolean not null default false` on the active row (a
channel-level default may seed it, but it is stored per stream so it is fixed for
that broadcast). It only has meaning while the broadcast is a public pre-live one; at
`live` the normal live chat applies regardless.

### Waiting room page

Reuse the existing live surface (`/{slug}/live` or the channel page's live region).
When the active stream is public and pre-live (`scheduled`/`preview` with a datetime),
render: the countdown to `scheduled_start_at`, a waiting count (presence members on
the page), and — if `waiting_room_chat` — the chat component. At `live`, the same
page renders the player; the chat is continuous across the transition because it is
scoped to the same stream id. A private `draft`/ad-hoc `preview` renders nothing
public.

### Chat pre-live

Extend chat availability from `live`-only to "public stream" (the visibility rule)
gated by `waiting_room_chat`. Read is public; post requires auth (unchanged). RLS on
insert must permit posting to a `scheduled`/`preview` stream when it is public and
`waiting_room_chat` is true, in addition to `live`. Chat stays scoped per stream id
(existing per-session scoping), so waiting-room messages carry into the live show.

### Schedule-save validation

Applied when the Settings save persists a `scheduled_start_at` (creating or keeping a
`scheduled` row). Before committing, the app checks:

- worker fresh? (heartbeat within `WORKER_HEARTBEAT_STALE_MS`)
- YouTube URL present on the broadcast?

If either is missing, show a confirmation listing exactly what is missing and the
effect: worker down ⇒ no moderation/scoring during the wait; no YouTube URL ⇒ no
YouTube chat merged. Buttons: **Schedule anyway** (commit) or **Fix first** (abort
the save). If both are satisfied, no dialog.

### First-time-schedule confirmation

When the save transitions the active row from no datetime (`draft`/ad-hoc) to a
datetime (`scheduled`), show a confirmation: "This publishes a public scheduled page
with a countdown." If `waiting_room_chat` is on, add: "and the waiting-room chat will
be public." This is distinct from the missing-deps warning; when both apply, present
them together in one dialog before committing.

## Risks

- Presence-based waiting count is approximate (best-effort), consistent with
  `viewer-cap`.
- The worker-fresh check is advisory: the owner can Schedule anyway; the waiting-room
  chat is simply unmoderated until the worker runs.
