## Why

The overlay that scrolls a line of text beside the member count is called "members" everywhere
— in the saved layout key, the panel label, the specs and the test ids. That name described it
when it only showed a count. It now carries arbitrary formatted messages, and the count is the
smaller half of it, so the name misdirects every reader.

Its editor is a plain text box holding raw markup. Writing a line with bold, colour and
underline means composing `say **bold** {#ff0055|hot}` and then switching tabs to find out
whether it looked right.

## What Changes

- **BREAKING** The overlay is renamed to "message banner" throughout: the stored layout key,
  the panel and settings labels, the capability spec, and the test ids. A migration moves the
  key on every saved layout.
- The messages editor becomes a rich text field. Text is typed and styled directly, with
  controls for bold, italic, underline and colour, and it renders as it will on the overlay.
  The existing markup remains the stored format, generated from what is typed and parsed back
  when an existing message is loaded for editing.
- The layout ships exactly one default message, "Chat to become a member at Vids.Tube!", which
  is already the case in code and is stated here so it cannot regress.

## Capabilities

### New Capabilities

### Modified Capabilities
- `member-count-overlay`: renamed to the message banner, with the stored key and labels changed
  and the single default stated.
- `overlay-message-markup`: the markup gains a documented round trip, so a message can be
  parsed into styled text for editing and regenerated from it without loss.

## Impact

- A migration rewriting `overlay_layouts.config`, moving the `members` entries in `boxes`,
  `visible` and `boxOpacity` to `messageBanner`, and leaving anything already migrated alone.
- `app/(app)/live/demo.types.ts`: the box key, the labels and the default layout.
- `lib/overlay-markup.ts`: a serializer to complement the existing parser.
- `app/(app)/live/settings-tab.tsx`: the messages editor.
- `components/overlay/member-count-strip.tsx` and its test ids, renamed with the overlay.
- Saved layouts written before the migration must keep their position, scale and opacity.
