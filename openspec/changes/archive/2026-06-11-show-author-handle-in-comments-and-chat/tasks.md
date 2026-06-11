## 1. Shared author identity primitives

- [x] 1.1 Add an `AuthorIdentity` type (`{ handle: string; avatarPath: string | null } | null`) to `app/layout.types.ts`
- [x] 1.2 Add a server helper that batches a `channels` read by distinct `owner_user_id`s and returns a `Map<userId, AuthorIdentity>` (select `handle`, `avatar_path` only; avatar resolved via `lib/storage` `channelAssetUrl` at render, path stored on the type)
- [x] 1.3 Extract a reusable `components/author-chip.tsx` from `components/channel-view.tsx` author presentation (avatar + `@handle` only — no display name, linked to the channel page, with initials fallback), with `comment` and `chat` size variants and a placeholder state for `null` identity

## 2. VOD comments

- [x] 2.1 In `listCommentsAction` (`app/watch/[videoId]/page.actions.ts`), resolve authors via the batch helper and map identity onto each row
- [x] 2.2 Add `author: AuthorIdentity` to `ScoredComment` in `app/watch/[videoId]/page.types.ts` (keep `userId` for ownership checks)
- [x] 2.3 Replace `formatAuthor(userId)` in `components/comments/comment-item.tsx` with `AuthorChip`; remove the `formatAuthor` slice

## 3. Live chat

- [x] 3.1 In `getChatMessagesAction` (`app/layout.actions.ts`), resolve authors via the batch helper and map identity onto each message
- [x] 3.2 Add `author: AuthorIdentity` to the `ChatMessage` type in `app/layout.types.ts`
- [x] 3.3 In `useLiveChat` (`app/layout.hooks.tsx`), resolve the author for realtime-inserted messages from the loaded channel set, falling back to a one-off lookup / placeholder without blocking display
- [x] 3.4 Replace the `user_id.slice(0, 8)` rendering in `components/live-chat.tsx` with `AuthorChip`

## 4. Chat replay

- [x] 4.1 In `getStreamChatReplayAction` (`app/watch/[videoId]/page.actions.ts`), resolve authors via the batch helper and carry identity through `toReplayMessages` (`lib/chat-replay.ts`)
- [x] 4.2 Add `author: AuthorIdentity` to `ReplayMessage` in `app/watch/[videoId]/page.types.ts`
- [x] 4.3 Replace the `userId.slice(0, 8)` rendering in `components/chat-replay.tsx` with `AuthorChip`

## 5. Verify

- [x] 5.1 Confirm no remaining `slice(0, 8)` author formatting across `components/comments`, `components/live-chat.tsx`, `components/chat-replay.tsx`
- [x] 5.2 `npm run build` / typecheck passes with the new author fields threaded through actions, types, hooks, and components
