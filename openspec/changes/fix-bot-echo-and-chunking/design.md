## Context

`deliverReply` stores the reply as its own chat row authored VidsBot, then sends the text to YouTube through Nightbot. `rememberSent` keeps the exact outgoing string in a 200-entry list. When the message comes back through the YouTube poller, `isNightbot` flags it and `consumeSelfEcho` drops it only if the text matches an entry exactly, removing that entry on the first match.

Three things rewrite the text between send and return. The sender chunks at 400 characters. YouTube accepts 200. Nightbot prepends two zero-width characters. So the returned text is a truncated, padded prefix of what was sent, and never matches exactly.

## Goals / Non-Goals

**Goals:**

- A bot reply appears exactly once in chat history, authored VidsBot.
- No reply is truncated mid-word or loses its continuation marker.
- A genuine Nightbot message the worker did not send is still kept.
- Recognition survives any further transport-side rewriting, rather than breaking again the next time something changes.

**Non-Goals:**

- Changing what the bot says, or when.
- Removing the bot from chat history or from VOD replay. Bot messages are visible; they are simply never scored.
- Making Nightbot's own timers distinguishable beyond "the worker did not send this".

## Decisions

### Match on a normalised prefix, not on exact text

An outgoing send is remembered as a normalised prefix: zero-width characters stripped, whitespace collapsed, case folded, truncated to a comparison length shorter than YouTube's limit. An incoming Nightbot message is normalised the same way and matched against that.

Exact matching is what broke. It assumes the transport is lossless, and this transport truncates and pads. Comparing a prefix shorter than the truncation point means the comparison holds whether or not the message was cut.

The alternative — tagging outgoing messages with a marker the echo carries back — was rejected because the marker would be visible to viewers in YouTube chat, and would itself be truncated away on a long message.

### Chunk to 200, because that is the real limit

The send budget becomes YouTube's actual 200-character limit, with the continuation marker counted inside it rather than added after.

Chunking at 400 meant every long reply arrived cut in half with its "(1/2)" marker missing, which is both the visible bug in AZ-204 and half the reason the echo never matched.

### An echo is dropped, never stored under another name

When a message is recognised as the worker's own, it is not written at all. The reply is already in chat history from the send side, authored VidsBot.

Storing it under the Nightbot identity, which is what happens today, is what produces the duplicate. Relabelling it afterwards would leave two rows for one message.

### Recognition is consumed once, but tolerantly

A matched entry is still removed, so a genuinely repeated message from Nightbot is not silently swallowed forever. The memory keeps its bounded size.

## Risks / Trade-offs

- **A prefix match could swallow a genuine Nightbot message that happens to start identically** → The comparison length is long enough that an accidental collision needs the first many characters to match a message the worker sent recently. The alternative, exact matching, fails constantly rather than rarely.
- **Chunking at 200 makes long replies span more chunks** → The chunk cap is unchanged, so a very long reply is still clipped; it is now clipped at a word boundary with a correct marker rather than mid-word with none.
- **Existing duplicates stay until cleaned** → The cleanup runs only after the fix is confirmed on a live broadcast, so the evidence is not destroyed before the fix is verified. Replacing the three site recordings already removed most of them.
