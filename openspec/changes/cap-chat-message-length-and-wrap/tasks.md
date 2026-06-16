## 1. Shared limit constant

- [ ] 1.1 Add `export const MAX_CHAT_MESSAGE_LENGTH = 200;` to `app/layout.types.ts`

## 2. Server enforcement

- [ ] 2.1 In `postChatMessageAction` (`app/layout.actions.ts`), import `MAX_CHAT_MESSAGE_LENGTH` and, after the empty-body check, return `{ error: "Message must be 200 characters or less." }` when `trimmed.length > MAX_CHAT_MESSAGE_LENGTH`

## 3. Composer cap

- [ ] 3.1 In `components/live-chat.tsx`, import `MAX_CHAT_MESSAGE_LENGTH` and set the composer `Input` `maxLength={MAX_CHAT_MESSAGE_LENGTH}` (replacing `500`)

## 4. Horizontal-overflow-safe rendering

- [ ] 4.1 In `components/live-chat.tsx`, add `break-words` to the message body element so long unbroken tokens wrap instead of x-scrolling the chat window
- [ ] 4.2 In `components/chat-replay.tsx`, add `break-words` to the message body element for the same behavior in VOD replay

## 5. Verification

- [ ] 5.1 Typecheck, lint, and build pass
- [ ] 5.2 Manually confirm: composer stops at 200 chars; a 201+ char post (client check bypassed) is rejected with the error toast; a single 300-character word wraps with no horizontal scroll in both live chat and VOD replay
