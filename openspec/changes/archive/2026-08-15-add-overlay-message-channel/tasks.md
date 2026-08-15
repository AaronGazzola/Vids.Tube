# Tasks

## 1. The protocol

- [x] 1.1 `lib/overlay-messages.ts`: `OVERLAY_MESSAGE_NS = "vidstube-overlay"`,
      `OVERLAY_MESSAGE_VERSION = 1`, and the message types. Frame to host: `ready`. Host to frame:
      `hello` carrying `{ channel, settings, box }`, `settings` carrying `{ settings }`, `box` carrying
      `{ width, height, scale }`.

      The namespace key is `ns` rather than `channel`. The first version used `channel` for both, and the
      namespace silently overwrote the channel id in every `hello`. Recorded in design.md.
- [x] 1.2 Same file: `parseOverlayMessage(data)` returning a typed message or null, checking the
      namespace before anything else and refusing a version it does not understand. Plus `sameBox` so an
      unchanged box is not re-sent.
- [x] 1.3 `tests/unit/overlay-messages.test.ts`: 8 cases. Every type round trips; a message with no
      namespace, a foreign namespace, a future version, an absent version, an unknown type, no type, and
      four non-object payloads are each refused.

## 2. The host end

- [x] 2.1 `components/overlay/use-overlay-conversation.ts`: the host end, extracted so it runs before
      `GameWindow`'s early return. Listens for `message` and accepts one only when `event.origin` is the
      permitted origin **and** `event.source` is the frame's own `contentWindow`.
- [x] 2.2 Same file: on `ready`, post `hello` with the channel, the settings and the box, naming the
      permitted origin explicitly rather than `"*"`.
- [x] 2.3 Same file: post `settings` when they change and `box` when it changes, only after the frame has
      announced itself, and never when nothing changed. Both are compared by value, because the route
      refetches every fifteen seconds and returns an equal object each time.
- [x] 2.4 `components/overlay/overlay-stage.tsx` and its types: the stage passes the box's width, height
      and the saved scale to `GameWindow`, since the stage is what knows them.

## 3. Settings that arrive without a reload

- [x] 3.1 `lib/overlay-installation.ts`: `installationForChannel` also returns the channel id and the
      resolved settings, so the payload the overlay route already polls carries them.
- [x] 3.2 Settings ride on `OverlayInstallation` rather than as a separate stage value, because they are
      only ever meaningful together with the installation they belong to.
- [x] 3.3 `app/(app)/live/overlay-settings-panel.tsx`: the note about needing a reload is gone, because
      it is no longer true. Saving also invalidates the channel installation query, so the owner's own
      surfaces update at the same moment the stream does.
- [x] 3.4 `tests/unit/game-window-pinning.test.tsx`: a settings change does not change the framed
      address. A changed address would reload the frame and defeat the entire change.

## 4. The SDK

- [x] 4.1 `public/overlay-sdk.js`: a hand-written ES module with no build step. Announces `ready`,
      listens for `hello`, `settings` and `box`, checks the namespace and version, ignores anything whose
      source is not the parent window, and exposes `onHello`, `onSettings`, `onBox` and `channel`. A late
      subscriber is replayed what is already known, and a listener that throws does not stop the others.
- [x] 4.2 Same file: a header stating that the protocol is the contract, that this file may be copied
      rather than loaded from the host, where the specification lives, and the protocol in full.
- [x] 4.3 `tests/unit/overlay-sdk.test.ts`: 10 cases, loading the module as a third party would. It
      announces to the parent, announces to a wildcard because it cannot know the host's origin, takes
      its state from `hello`, delivers later changes, replays to a late subscriber, and ignores a message
      from a non-parent source, a foreign namespace, and an unknown version.

## 5. Verify

- [x] 5.1 `tests/e2e/overlay-message-channel.spec.ts`: the overlay's address is intercepted and answered
      with a document loading the **real** SDK, so the frame is genuinely on the permitted origin and both
      ends' origin checks are exercised rather than stubbed. Against the real overlay route, the frame
      receives its channel id, its settings with declared defaults filled in, and a box with a positive
      width, height and scale.
- [x] 5.2 Same spec, second case: with that frame running, a saved change reaches it within one refetch,
      and the frame's `src` is unchanged across it.

      Written here rather than appended to `overlay-settings.spec.ts` as the task first said, because it
      needs the intercepted frame that this spec sets up.
- [x] 5.3 `npx tsc --noEmit` clean, `npx eslint` clean over every changed file, 655 unit tests pass
      across 55 files, and `npm run build:local` completes.
- [x] 5.4 `tests/e2e/game-window.spec.ts` passes unchanged, so the real overlay route still frames the
      dragon and is still not reloaded by a poll. Eleven end-to-end cases pass across the three earlier
      overlay specs.
