## 1. Schema

- [x] 1.1 `npx supabase migration new waiting_room_chat`; add
  `streams.waiting_room_chat boolean not null default false`
- [x] 1.2 Update chat-insert RLS so an authenticated user may post to a stream that is
  public and pre-live (`scheduled`/`preview` with a datetime) when
  `waiting_room_chat` is true, in addition to `live`
- [x] 1.3 `npx supabase db push`; regenerate types

## 2. Chat available in the waiting room

- [x] 2.1 Extend the chat read/post hooks + action to accept a public
  `scheduled`/`preview` stream (gated by `waiting_room_chat`), scoped to that stream
  id, reusing per-session scoping
- [x] 2.2 Keep the anonymous read / sign-in-to-post behaviour unchanged

## 3. Waiting room page

- [x] 3.1 On the public live surface (`/{slug}/live` and/or the channel live region),
  render for a dated pre-live broadcast: countdown to `scheduled_start_at`, a waiting
  count (presence members), and the chat when `waiting_room_chat` is on
- [x] 3.2 At go-live, swap the countdown for the live player on the same page,
  preserving the chat (same stream id)
- [x] 3.3 Ensure a private `draft`/ad-hoc `preview` renders nothing public
- [x] 3.4 Reuse presence (`viewer-cap`) for the waiting count

## 4. Schedule-save validation (Settings save)

- [x] 4.1 When a save persists a `scheduled_start_at`, check worker freshness
  (heartbeat) and YouTube URL presence
- [x] 4.2 If either is missing, show a confirmation listing what is missing + the
  effect, with Schedule anyway / Fix first
- [x] 4.3 When the save newly adds a datetime, show a confirmation that a public
  scheduled page will appear, and — if `waiting_room_chat` is on — that chat will be
  public; combine with 4.2 into one dialog when both apply

## 5. Verification

- [x] 5.1 `npx tsc --noEmit`, `npx eslint`, `doppler run -- npm run build` pass
- [x] 5.2 Script test (remote db): posting to a public `scheduled` stream with
  `waiting_room_chat` on succeeds and is rejected when off/private; the waiting page
  shows countdown + count + chat, and swaps to the player at go-live keeping chat
