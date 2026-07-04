## Why

Live chat has no real length cap (the composer's `maxLength={500}` is wrong versus YouTube's 200 and is unenforced server-side, so any client can persist arbitrarily long messages), and long unbroken words (pasted URLs, `aaaaaa…`) overflow horizontally and make the chat window scroll on the x-axis. This promotes Linear issue AZ-84.

## What Changes

- Cap chat messages at **200 characters** (YouTube parity), enforced in two places:
  - Client: the composer input `maxLength` becomes `200`.
  - Server: `postChatMessageAction` returns an expected-error `ActionResult` (`{ error }`) when the trimmed body exceeds 200 characters, so the cap holds regardless of the client.
- Break long words in rendered message bodies so the chat window **never** scrolls horizontally — applied to both the live chat list and the VOD chat-replay list.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `live-chat`: the "Authenticated chat posting" requirement gains a maximum-length bound (200 chars) enforced server-side; a new requirement governs horizontal-overflow-safe rendering of message bodies.
- `vod-chat-replay`: the replay rendering requirement gains the same horizontal-overflow-safe message-body behavior.

## Impact

- `components/live-chat.tsx` — composer `maxLength`; message body word-break.
- `components/chat-replay.tsx` — message body word-break.
- `app/layout.actions.ts` — `postChatMessageAction` length validation.
- No database, migration, or RLS changes; the 200-char cap is an application-level rule.
