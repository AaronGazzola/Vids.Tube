## Context

Live chat posting is split between a client composer (`components/live-chat.tsx`) and a server action (`postChatMessageAction` in `app/layout.actions.ts`). Today the composer caps input at `maxLength={500}` and the server validates only non-empty. Message bodies render as a plain `<span>{message.body}</span>` in both `live-chat.tsx` and `chat-replay.tsx`, with no overflow handling, so a single long token forces horizontal scroll.

## Goals / Non-Goals

**Goals:**
- Enforce a 200-character cap on both the client and the server.
- Guarantee message bodies wrap so neither chat window scrolls horizontally.

**Non-Goals:**
- No database column constraint or migration — the cap is an application rule.
- No change to chat read, realtime delivery, author resolution, or RLS.
- No rich-text or link handling beyond preventing horizontal overflow.

## Decisions

- **Single source of truth for the limit.** Define `MAX_CHAT_MESSAGE_LENGTH = 200` once and use it for both the composer's character accounting and the server check, so the two cannot drift. It lives in `app/layout.types.ts` (already the home for shared chat types and imported by both the action and the hooks layer), exported as a plain constant.
  - Alternative considered: separate literals in each file — rejected as drift-prone.
- **Soft over-limit composer, not a hard `maxLength`.** The composer is a `Textarea` (word-wrapping, auto-sizing) with NO `maxLength`, so the user can keep typing past 200. A remaining-character count appears as the limit nears, and once over the limit the over-200 characters are tinted red, the Send button is disabled, and an explanatory message is shown. Server enforcement remains the real gate.
  - Rendering the red over-limit characters inside a textarea is done with the standard "highlight backdrop" technique: a `aria-hidden` mirror div sits behind a transparent-text textarea (caret kept visible), rendering `draft.slice(0, MAX)` normally and `draft.slice(MAX)` in a red span. The mirror shares the textarea's exact box metrics (font, padding, border, `whitespace-pre-wrap`, `break-words`) and its `scrollTop` is synced from the textarea so the highlight stays aligned.
  - Alternative considered: a `contentEditable` rich input — rejected as heavier and more error-prone for caret/IME handling than a textarea + backdrop.
  - Enter sends; Shift+Enter inserts a newline (chat convention).
- **Server enforcement returns an expected error.** `postChatMessageAction` already returns `ActionResult`; add a branch after the empty-check: when `trimmed.length > MAX_CHAT_MESSAGE_LENGTH`, `return { error: "Message must be 200 characters or less." }`. This follows the expected-vs-unexpected split (a user-correctable input is a returned value, not a throw), and the existing `usePostChatMessage` hook already unwraps `error` into the toast plumbing.
  - The check is on the trimmed body, matching what is persisted.
- **Word-break via Tailwind `break-words`.** Add `break-words` (`overflow-wrap: anywhere` semantics) to the message body element in both `live-chat.tsx` and `chat-replay.tsx`. The body is wrapped in a flow container, so `break-words` on the text element is sufficient to force long tokens to wrap; `min-w-0` is not needed because the message rows are block, not flex children competing for width.
  - Alternative considered: `break-all` — rejected because it breaks every word mid-character, hurting readability; `break-words` only breaks tokens that would otherwise overflow.

## Risks / Trade-offs

- [Counting by `.length` (UTF-16 code units) differs from grapheme count for emoji/surrogate pairs] → Acceptable: this matches the JS `maxLength` attribute's own counting, so client and server agree, and 200 is a soft UX cap rather than a storage limit.
- [`break-words` can split a long URL across lines, making it non-obviously copyable] → Acceptable and expected; matches YouTube's behavior and is strictly better than horizontal scroll.
