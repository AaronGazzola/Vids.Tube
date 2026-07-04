## 1. Shared limit constant

- [x] 1.1 Add `export const MAX_CHAT_MESSAGE_LENGTH = 200;` to `app/layout.types.ts`

## 2. Server enforcement

- [x] 2.1 In `postChatMessageAction` (`app/layout.actions.ts`), import `MAX_CHAT_MESSAGE_LENGTH` and, after the empty-body check, return `{ error: "Message must be 200 characters or less." }` when `trimmed.length > MAX_CHAT_MESSAGE_LENGTH`

## 3. Soft over-limit composer

- [x] 3.1 In `components/live-chat.tsx`, replace the single-line `Input` composer with a word-wrapping `Textarea` (no `maxLength`), Enter-to-send / Shift+Enter-newline
- [x] 3.2 Add the highlight backdrop: an `aria-hidden` mirror div behind a transparent-text textarea that renders the over-`MAX_CHAT_MESSAGE_LENGTH` characters in red, with synced scroll and matching box metrics
- [x] 3.3 Show the remaining-character count as the draft nears the limit, and an over-limit explanatory message once exceeded
- [x] 3.4 Disable Send while the draft is over the limit (and while empty/pending)

## 4. Horizontal-overflow-safe rendering

- [x] 4.1 In `components/live-chat.tsx`, add `break-words` to the message body element so long unbroken tokens wrap instead of x-scrolling the chat window
- [x] 4.2 In `components/chat-replay.tsx`, add `break-words` to the message body element for the same behavior in VOD replay

## 5. Verification

- [x] 5.1 Typecheck, lint, and build pass

> Reconciliation (2026-07-04): removed 1 manual/live verification task(s) per governance rule 2; tracked in Linear (AZ-146 for UI/routing + chat-length; signup live email verify + AZ-55; live-entry verification issue).
