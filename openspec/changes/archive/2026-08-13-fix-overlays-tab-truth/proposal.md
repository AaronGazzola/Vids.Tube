## Why

The Overlays tab was built to compose overlays against their real values, and it does not.
An overlay whose value resolves to nothing renders nothing at all, so with no broadcast
connected only the highlight slot, the message banner and the game window appear. The goal
bars, the leaderboard and the break card are simply absent, and turning the resize switch on
does not bring them back — the only way to see them is to turn demo on, which is exactly the
invented data the tab was meant to stop relying on.

The reverse fault sits beside it: the highlight slot draws a dashed "Highlight" placeholder
whenever it is empty, so the one overlay that should be invisible when idle is the one always
on screen.

Composing a layout therefore means either guessing where the missing overlays are, or
positioning them against demo values and hoping the real ones land the same way.

## What Changes

- Every visible overlay renders at all times from its real current value, including when that
  value is zero, absent or empty.
  - Goal bars render against the targets saved on the Settings tab, showing real progress
    during a broadcast and zero before one.
  - The leaderboard renders as an empty frame until somebody is scored, then fills.
  - The break card renders in its stopped state until a break is set.
- The highlight slot renders nothing when idle, matching the audience surface. Its dashed
  placeholder appears only while the resize switch is on, where it exists so the slot can be
  positioned before anything has played through it.
- **BREAKING** The overlay panel is no longer opened by a text button floating on the stage.
  An icon button sits to the right of the tab list, shows an active state while the panel is
  open, and toggles it.
- The live page header wraps on small screens, putting the tab list on its own line above the
  mod indicators, the demo switch and the pop-out button.

## Capabilities

### New Capabilities

### Modified Capabilities
- `live-overlays-tab`: overlays render their real values at all times rather than
  disappearing when a value is absent; the idle placeholder is bound to resize mode; the panel
  is toggled from an icon beside the tabs.
- `streamer-control-room`: the live page header reflows on small screens so the tabs are not
  crowded onto one line with the other controls.

## Impact

- `components/overlay/overlay-stage.tsx`: stops treating an absent value as "render nothing",
  and takes the resize state so the placeholder can be bound to it.
- `app/(app)/live/overlays-tab.hooks.tsx`: resolves goal metrics from the saved targets rather
  than returning null when no broadcast is active.
- `app/(app)/live/overlays-tab.tsx`: the panel-open button moves out of the stage.
- `app/(app)/live/page.tsx`: the tab bar gains the panel icon and a wrapping header.
- The OBS route must be unaffected: it already renders nothing when idle and must continue to.
