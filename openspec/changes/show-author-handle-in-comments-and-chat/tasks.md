## 1. Shared author identity primitives

- [ ] 1.1 Add an `AuthorIdentity` type (`{ handle: string; name: string; avatarPath: string | null } | null`) to `app/layout.types.ts`
- [ ] 1.2 Add a server helper that batches a `channels` read by distinct `owner_user_id`s and returns a `Map<userId, AuthorIdentity>` (avatar resolved via `lib/storage` `channelAssetUrl` at render, path stored on the type)
- [ ] 1.3 Extract a reusable `components/author-chip.tsx` from `components/channel-view.tsx` author presentation (avatar + name + `@handle`, linked to the channel page, with initials fallback), with `comment` and `chat` size variants and a placeholder state for `null` identity

## 2. VOD comments

- [ ] 2.1 In `listCommentsAction` (`app/watch/[videoId]/page.actions.ts`), resolve authors via the batch helper and map identity onto each row
- [ ] 2.2 Add `author: AuthorIdentity` to `ScoredComment` in `app/watch/[videoId]/page.types.ts` (keep `userId` for ownership checks)
- [ ] 2.3 Replace `formatAuthor(userId)` in `components/comments/comment-item.tsx` with `AuthorChip`; remove the `formatAuthor` slice

## 3. Live chat

- [ ] 3.1 In `getChatMessagesAction` (`app/layout.actions.ts`), resolve authors via the batch helper and map identity onto each message
- [ ] 3.2 Add `author: AuthorIdentity` to the `ChatMessage` type in `app/layout.types.ts`
- [ ] 3.3 In `useLiveChat` (`app/layout.hooks.tsx`), resolve the author for realtime-inserted messages from the loaded channel set, falling back to a one-off lookup / placeholder without blocking display
- [ ] 3.4 Replace the `user_id.slice(0, 8)` rendering in `components/live-chat.tsx` with `AuthorChip`

## 4. Chat replay

- [ ] 4.1 In `getStreamChatReplayAction` (`app/watch/[videoId]/page.actions.ts`), resolve authors via the batch helper and carry identity through `toReplayMessages` (`lib/chat-replay.ts`)
- [ ] 4.2 Add `author: AuthorIdentity` to `ReplayMessage` in `app/watch/[videoId]/page.types.ts`
- [ ] 4.3 Replace the `userId.slice(0, 8)` rendering in `components/chat-replay.tsx` with `AuthorChip`

## 5. Verify

- [ ] 5.1 Confirm no remaining `slice(0, 8)` author formatting across `components/comments`, `components/live-chat.tsx`, `components/chat-replay.tsx`
- [ ] 5.2 `npm run build` / typecheck passes with the new author fields threaded through actions, types, hooks, and components
