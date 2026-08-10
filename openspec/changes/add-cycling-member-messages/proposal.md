## Why

The members strip carries one sentence, written into the component. It is the only place
on the broadcast that talks directly to a viewer who has not joined in, and it can only
ever say one thing, so it says the same thing for the whole broadcast and stops being
read. Saying several things in turn is how a strip that size holds attention, and the
streamer has no way to change what it says without a deploy.

## What Changes

- The members strip cycles through a list of messages instead of showing one fixed
  sentence. The strip scrolls vertically between them: the message showing moves downward
  out of the strip while the next enters from above.
- The member count belongs to the first message only. Later messages take the full width
  of the strip, and the count returns when the cycle returns to the first message.
- A single configured message does not cycle and does not animate, so a streamer who wants
  one sentence gets exactly today's behaviour.
- Messages are written by the streamer in the Settings tab of `/live`, added, reordered
  and removed there, and reach the live overlay through the same push that already carries
  a layout edit.
- Messages carry formatting: bold, italic, underline, and a text colour. Formatting is
  written as a small markup dialect, and the editor inserts the markup around the
  selection so the streamer presses a button rather than typing punctuation.
- The editor shows the message rendered as the overlay will draw it, because markup that
  is typed and never previewed is markup that ships wrong.
- Correction while in the same requirement: the specification still describes the strip as
  stacking the member total above the word "Members". The strip has since been changed to
  show the site's logo beside the total instead, and the specification is brought back into
  line with what is drawn.

## Capabilities

### New Capabilities

- `overlay-message-markup`: the markup dialect for bold, italic, underline and colour, how
  it is parsed, how unknown or malformed markup behaves, and the authoring surface that
  writes it.

### Modified Capabilities

- `member-count-overlay`: the strip carries a list of messages rather than one sentence,
  cycles between them, and shows the member count on the first message only. Also corrects
  the stale description of the count's label.

## Impact

- **Overlay**: the members strip component gains the cycle and the markup renderer. The
  overlay frame needs no new subscription, because messages travel inside the layout that
  is already pushed and already polled.
- **Settings**: a new section in the `/live` Settings tab for writing, ordering and
  removing messages, alongside the existing sections for projects and chat commands.
- **Layout storage**: messages are stored in the saved overlay layout, so no new table and
  no migration. A layout saved before this change has no messages and falls back to the
  sentence the strip carries today, so nothing regresses on deploy.
- **Unaffected**: the member count itself, its polling cadence, and every other overlay
  surface.
