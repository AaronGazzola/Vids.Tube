## Why

Every reply the worker sends is posted to YouTube by Nightbot, then read back by the YouTube poller as a Nightbot message. Those echoes are supposed to be recognised and dropped. They are not, so a bot reply appears in chat twice: once correctly as VidsBot, and once as @nightbot.

The recognition is exact-text and single-use. It fails because the text that comes back is not the text that was sent: YouTube truncates a message at 200 characters, the sender chunks at 400, and Nightbot prepends two zero-width characters to everything it posts. Any one of those breaks an exact match.

So the two faults are one fault seen from both ends. The sender writes messages YouTube will cut in half, and the receiver cannot recognise what comes back because it was cut.

## What Changes

- The send-side budget drops from 400 characters to YouTube's actual limit of 200, so a reply is never truncated mid-word and never loses its continuation marker.
- Echo recognition stops depending on exact text. Outgoing sends are matched on a normalised prefix, so a truncated or zero-width-padded echo is still recognised.
- A recognised echo is dropped rather than stored, so a bot reply appears exactly once, authored VidsBot.
- A genuine Nightbot message that the worker never sent is still kept, since the streamer may run Nightbot's own timers.
- Existing duplicates are removed, keeping one copy of each distinct message.

## Capabilities

### Modified Capabilities

- `bot-chat-replies`: replies are chunked to YouTube's real limit, and echo recognition tolerates the transport rewriting the text.

## Impact

- The worker's reply sender and its echo memory.
- The YouTube ingest path, which drops recognised echoes.
- A one-off cleanup of the duplicate rows already stored, run only after the fix is confirmed on a live broadcast so the evidence is not destroyed first.
