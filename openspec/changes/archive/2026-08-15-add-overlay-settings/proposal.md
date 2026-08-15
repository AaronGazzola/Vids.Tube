## Why

The third foundation point in `docs/overlay-platform.md` §5 is that **settings are stored per channel per
overlay as an opaque blob**. Nothing is stored today, so a streamer cannot configure a framed overlay at
all, and the only per-channel thing an overlay knows is which channel it is on.

The shape has to be right before a second overlay exists. Modelling one game's settings as columns in
this database would force a migration for the second game and make the host responsible for validating
values it cannot understand.

## What Changes

- An installation carries a settings blob. The host stores it, hands it over, and never interprets it.
- An overlay **declares its fields** on its registry row: a key, a label, a type and a default. The host
  renders inputs from that declaration without knowing what any value means.
- The Overlays tab gains an editor built from the declaration, so a streamer changes a number with a
  slider rather than by typing JSON.
- A framed overlay reads its settings from a token-authenticated endpoint on load.
- The dragon overlay declares nothing yet, so its editor is empty until the eco3d side names its own
  fields. The mechanism ships without inventing settings for a game this repository does not own.

## Capabilities

### New Capabilities

- `overlay-settings`: an installation holds a settings blob the host stores and never interprets; an
  overlay declares the fields its settings have; the channel owner edits them; a framed overlay reads
  them with its token.

## Impact

- One column on `overlays` for the field declaration, one on `channel_overlays` for the values.
- A public read endpoint alongside the token exchange, sharing its cross-origin handling.
- `app/(app)/live/overlay-install-list.tsx` grows the editor, with its action and hook.
- Live push of an edit while the overlay is running is **not** in this change. It needs the page-to-frame
  message channel, which is its own change; until then an overlay reads its settings when it loads.
- No change to the token, the registry's identity, the framing policy, or any built-in overlay.
