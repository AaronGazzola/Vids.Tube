## Why

The message banner shows one number, the member count, always beside the first message and
nowhere else. That was right when the overlay was the member count with a line of text beside
it. It is now the streamer's own banner, and which number belongs on a line is a per-line
decision: a line about the leaderboard wants the chatter count, a line about a goal wants subs.

Editing it is still split in two. A message is typed into a field and judged in a rendering
beside it, so the thing being written and the thing being looked at are never the same object.
The field was made styled text in the previous change, which leaves the split as the remaining
piece of the old markup editor.

The colour control is a native colour input, which opens the operating system's picker, looks
foreign in the panel, and fires continuously while dragging.

## What Changes

- **BREAKING** The member count is no longer fixed to the first message. Each message may carry
  one metric of its own, or none. Existing saved messages are migrated so the first message
  carries the member count, and nothing disappears from a broadcast.
- Each message gains a checkbox to include a metric, and when included:
  - a dropdown choosing which metric, from total subs, new subs this stream, likes this stream,
    current viewers, total unique chatters, total chat commands, members, and new members this
    stream;
  - a dropdown choosing the icon shown beside it, from the Vids.Tube logo, the three goal icons,
    and a curated set of extras;
  - a colour for the icon.
- Three of those metrics have no query yet and gain one: total unique chatters, total chat
  commands, and new members this stream.
- **BREAKING** The separate text field is removed. The banner rendering itself is the editable
  surface, so the message is typed into the thing that goes on air.
- The colour controls use `react-colorful`, a new dependency, for both message text and icon
  colour.

## Capabilities

### New Capabilities
- `message-banner-metrics`: which metrics a banner message may show, where their numbers come
  from, and how the icon and its colour are chosen.

### Modified Capabilities
- `member-count-overlay`: the count stops being fixed to the first message and becomes one
  metric among several, chosen per message.
- `overlay-message-markup`: the banner rendering becomes the editable surface, replacing the
  field-and-preview pair.

## Impact

- A migration adding a metric to each saved layout's first message, so the count survives.
- `app/(app)/live/demo.types.ts`: `StripMessage` gains an optional metric.
- `components/overlay/message-banner.tsx`: renders the chosen metric and icon rather than the
  member count.
- `app/(app)/live/message-banner-field.tsx`: becomes the banner itself rather than a plain box.
- `app/(overlay)/overlay/[channelSlug]/page.actions.ts` and its hooks: three new counts.
- `package.json`: `react-colorful`.
- The OBS route and the Overlays tab must resolve the same numbers, through the one renderer.
