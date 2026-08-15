## Why

Everything the host tells a framed overlay today is said once, at load, in a URL. A streamer who changes
a setting mid-stream changes nothing until the browser source is reloaded, and the overlay panel has to
apologise for it in text.

`docs/overlay-platform.md` §4 has the host providing configuration *"pushed live when the streamer edits
it"* and lifecycle messages. Neither is possible without a way for the page and the frame to talk. This
is also the last piece of plumbing before chat events can reach a game, since events arrive the same way.

## What Changes

- A versioned message protocol between the overlay page and the framed overlay, over `postMessage`, with
  the origin checked in both directions.
- The frame announces itself; the host answers with the channel it serves and the current settings.
- Settings changes reach a running overlay without a reload. The settings ride on the installation the
  overlay route already polls, and are pushed to the frame when they change.
- The frame is told the size of the box it has been given, and told again when that changes.
- A small SDK, served by the host and equally free to be copied, so an overlay author writes
  `onSettings(...)` rather than a `postMessage` listener. The protocol is the contract; the SDK is a
  convenience and never a requirement.
- The Overlays tab stops warning that a saved change needs a reload, because it no longer does.

## Capabilities

### New Capabilities

- `overlay-message-channel`: a versioned, origin-checked conversation between the overlay page and a
  framed overlay, carrying the channel it serves, its settings as they change, and the size of its box.

### Modified Capabilities

- `overlay-settings`: settings reach a running overlay when the streamer saves, rather than only when
  the overlay loads.

## Impact

- `lib/overlay-messages.ts` for the protocol's shape, shared by the host and the SDK.
- `public/overlay-sdk.js`, hand-written with no build step so it can be read by whoever has to trust it.
- `components/overlay/game-window.tsx` holds the host end of the conversation.
- `getInstalledOverlayAction` and `getChannelInstallationAction` carry settings alongside the token.
- **Shown and hidden are not sent.** A hidden overlay box is not rendered, so its frame does not exist to
  be told anything. Sending a message no listener can receive would be theatre.
- No change to the token, the registry, the framing policy, or any built-in overlay.
