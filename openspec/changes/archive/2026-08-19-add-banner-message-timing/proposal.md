## Why

The message banner cycles every message for the same fixed six seconds. Some messages are a few words
and some fill the line, and they do not deserve the same time on screen. The streamer cannot change it
at all, because the dwell is a constant in the code.

The border is the same kind of problem in the other direction: the banner is always drawn inside a white
rounded frame, and on some backgrounds the streamer wants the words on the broadcast with no box around
them.

Both are settings whose effect is visible the moment they are changed, which is what makes them worth
building while streaming.

## What Changes

- A global display time in the message banner's settings, applying to every message that does not carry
  its own.
- An optional per-message display time. Set, it wins; unset, the message follows the global one.
- Unset is stored as absent rather than as a number, so a message that never had its own time keeps
  moving when the global changes. A message set to the same number as the global is a different thing
  and stays pinned to that number.
- A toggle for the banner's border. Off, the banner draws its text and its metric with no frame and no
  backing.
- The Overlays tab preview cycles at the configured times, so the setting can be judged without going
  live.
- A layout saved before either setting keeps working: no stored time means the global, and no stored
  border preference means the border as it is drawn today.

## Capabilities

### Modified Capabilities

- `member-count-overlay`: the banner's cycle is timed by configuration rather than by a constant, and
  its border is switchable.

## Impact

- `app/(app)/live/demo.types.ts`: `StripMessage` gains an optional dwell, and `DemoLayoutConfig` gains a
  global dwell and a border flag. No layout version bump — every field is additive and absent means the
  behaviour that exists today.
- `components/overlay/message-banner.tsx`: the cycle timer reads the showing message's time instead of
  `OVERLAY_MESSAGE_DWELL_MS`, and the surface classes become conditional.
- `app/(app)/live/settings-tab.tsx`: the global controls beside the message list, and a per-message time
  in each message's control row.
- **Not in this change:** per-message transition style or direction, a border colour or width control,
  and any change to the banner's width, height or metric behaviour.
