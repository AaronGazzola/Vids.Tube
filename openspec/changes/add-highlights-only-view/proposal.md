## Why

The Activity tab shows every message. During a busy broadcast that is more than the streamer can read
while streaming, and the messages worth reacting to are exactly the ones the AI has already picked out.

While specifying this, the ticket's premise turned out to be wrong in a way that matters. AZ-261 records
that a `!command` message *can* be featured and simply never has been, in 66 featured messages. It cannot
be. `processCommands` returns only the non-command messages, and `worker/jobs/score.ts` reassigns its
batch to that return value before the `!isHost` filter runs. Every command message is dropped before the
scorer ever sees it, so 0 of 66 is a certainty rather than a coincidence.

The owner's decision is that command messages **should** be scored and featurable: a good `!ask` question
or a funny `!tts` line is chat worth featuring, and excluding it silently loses the best moments of the
broadcast. So the exclusion goes, and this change is the view that makes the result visible.

## What Changes

- Command messages are scored like any other chat. They still execute exactly as they do now, and they
  still remain visible in chat; the only change is that the scorer sees them.
- A toggle on the Activity tab switches between every message and highlights only, showing just the
  messages the AI featured for the current broadcast.
- The toggle is a view filter, not a setting. Nothing about scoring, featuring, or the overlay changes
  when it is flipped.
- Highlights-only draws the same message rows as today, so no layout is rebuilt.
- Early in a broadcast nothing has been featured yet, and the empty view says so rather than reading as
  a broken tab.

## Capabilities

### Modified Capabilities

- `chat-commands`: a command message is sent to the scoring batch instead of being withheld from it.
- `streamer-control-room`: the live chat panel can be filtered to featured messages only.

## Impact

- `worker/jobs/score.ts` keeps its full batch for scoring rather than replacing it with the non-commands
  `processCommands` returns.
- `app/(app)/live/panels.tsx`: the chat panel gains the filter, using the featured-message map it already
  builds. No new query.
- **Not in this change:** any change to what the AI is asked to score, any per-command scoring exclusion,
  and any change to the overlay's featured-message feed.
