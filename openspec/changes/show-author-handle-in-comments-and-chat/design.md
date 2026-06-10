## Context

Three surfaces render message/comment authors as `userId.slice(0, 8)`:
`components/comments/comment-item.tsx` (via `formatAuthor`),
`components/live-chat.tsx`, and `components/chat-replay.tsx`. None of the read
actions join author identity — comments come from `app/watch/[videoId]/page.actions.ts`
(`listCommentsAction`), live chat from `app/layout.actions.ts` (`getChatMessagesAction`),
and replay from `app/watch/[videoId]/page.actions.ts` (`getStreamChatReplayAction`).

The channel scaffold (AZ-23) is already implemented: a `channels` table with a
1:1 `owner_user_id → channel` relationship exposing `handle`, `name`, and
`avatar_path`, plus the existing `channels` spec requirement "Channel rows remain
readable for identity resolution". `components/channel-view.tsx` already renders
the canonical avatar + name + `@handle` presentation, and `lib/storage`
(`channelAssetUrl`) resolves avatar URLs. So the work is a UI + read-query wiring
problem, not a data-model problem.

## Goals / Non-Goals

**Goals:**
- Render author channel `@handle`, display name, and avatar (linked to the channel
  page) in VOD comments, live chat, and chat replay.
- Resolve authors in a single batched channels read per message set (no N+1).
- Define one stable fallback for authors without a resolvable channel.
- Remove all `userId.slice(0, 8)` author formatting.

**Non-Goals:**
- No changes to the `channels` table, RLS, or migrations.
- No change to how messages/comments are *written* (still attributed by `user_id`).
- No new identity caching layer beyond per-query batching; live-chat realtime
  inserts may resolve their author lazily.
- No change to comment voting, ordering, replay timing, or chat scoping behavior.

## Decisions

**1. Resolve identity server-side in the read actions, return it on the row.**
Each read action collects the distinct `user_id`s in its result set, issues one
`channels` query `in('owner_user_id', ids)`, and maps `handle`/`name`/`avatar_path`
onto each returned row. Alternative — resolving per-author in the client via React
Query — was rejected: it fans out one request per distinct author and duplicates
identity logic across three components.

**2. Carry a structured `author` object on the row types.** Extend `ScoredComment`,
`ChatMessage`, and `ReplayMessage` with an `author: { handle, name, avatarPath } | null`
(keep `userId` for ownership checks like `isAuthor`). A shared
`app/layout.types.ts` `AuthorIdentity` type backs all three. Alternative — three
loose fields per type — was rejected for drift risk.

**3. Shared presentational author chip.** Extract the avatar + name + `@handle`
+ channel link presentation (already in `components/channel-view.tsx`) into a
reusable component (e.g. `components/author-chip.tsx`) consumed by all three
surfaces, with size variants for the comment header vs. the denser chat rows.
Alternative — duplicating markup three times — rejected; the channel-view version
is the source of truth for fallback initials and asset URL resolution.

**4. Realtime live-chat inserts.** New messages arriving over the Supabase
realtime subscription carry only `chat_messages` columns. The subscription handler
resolves the author for the incoming `user_id` against the already-loaded channel
map, falling back to a one-off channel lookup (or the placeholder) when the author
is not yet known. This keeps the realtime path from blocking on identity.

**5. Fallback presentation.** When no channel resolves for a `user_id`, render a
neutral placeholder (e.g. "Unknown channel" with default avatar initials) — never
the raw uuid and never an error. Onboarding forces a handle before app access, so
this is an edge case (deleted channel, race), not a routine state.

## Risks / Trade-offs

- **Extra read per message fetch** → mitigated by a single batched `in(...)` query
  keyed on the distinct author set; bounded by page/comment size.
- **Realtime author not yet in the map** → mitigated by lazy per-message lookup
  with placeholder fallback while it resolves; never blocks message display.
- **`channel-view.tsx` refactor regresses the channel page** → mitigated by
  extracting the chip without altering channel-view's own layout, only its
  internal author-presentation block.
- **Handle/name/avatar go stale after an edit** → acceptable; identity reflects
  the channel state at read time, consistent with the rest of the app.

## Open Questions

- Should a missing-channel author link anywhere, or render as plain (non-link)
  text? (Leaning plain text for the fallback.)
