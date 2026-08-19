# Tasks

## 1. The stored shape

- [x] 1.1 In `app/(app)/live/demo.types.ts`, add `dwellMs?: number` to `StripMessage` and
      `bannerDwellMs: number` plus `bannerBorder: boolean` to `DemoLayoutConfig`. Optional on the message
      because absent is the meaning that "follows the global"; required on the config because the layout
      loader fills a default and a global that could be absent would need the same fallback twice.
- [x] 1.2 Add `bannerDwellMs: OVERLAY_MESSAGE_DWELL_MS` and `bannerBorder: true` to
      `DEFAULT_DEMO_LAYOUT`, so a channel that never touches the settings keeps today's behaviour
      exactly.
- [x] 1.3 Do not bump `DEMO_LAYOUT_VERSION`. Both fields are additive and a saved layout missing them
      means today's behaviour; a bump would put every saved box position at risk for no gain.
- [x] 1.4 In `lib/demo-overlay.ts` add `OVERLAY_MESSAGE_DWELL_MIN_MS` and `OVERLAY_MESSAGE_DWELL_MAX_MS`.
      The minimum must exceed `OVERLAY_MESSAGE_TRANSITION_MS`, or a message would begin leaving before it
      finished arriving.

## 2. Resolving which time applies

- [x] 2.1 `lib/banner-dwell.ts`: `resolveDwell(message, globalMs)` returning the message's own time when
      it is present and within range, and the global otherwise. Pure, and the single place the precedence
      rule is written.
- [x] 2.2 The global itself is clamped to the same range by the same helper, so a config carrying an
      unusable global cannot stop the banner cycling at all.
- [x] 2.3 `tests/unit/banner-dwell.test.ts`: absent takes the global; a set time wins; a set time equal to
      the global stays pinned when the global changes (asserted by resolving twice against two globals);
      below the minimum, above the maximum, zero, negative and non-numeric each fall back to the global;
      an unusable global falls back to the default.

## 3. Cycling at the configured time

- [x] 3.1 In `components/overlay/message-banner.tsx`, replace the fixed `setInterval` on
      `OVERLAY_MESSAGE_DWELL_MS` with a `setTimeout` scheduled from the showing message's resolved time,
      rescheduled on each advance. An interval cannot express a per-message duration.
- [x] 3.2 Take the global from the config the banner is already handed rather than adding a prop chain:
      pass it alongside `messages` from `overlay-stage.tsx`, which already reads `config`.
- [x] 3.3 Keep the existing guards intact: a single message still does not cycle and starts no timer, and
      an edit that shortens the list still cannot leave the banner pointing past its end.
- [x] 3.4 Fake-timer coverage: three messages advance at the global time; a message carrying its own
      advances at that instead; a mixed list times each message by its own rule; an unusable per-message
      time takes the global; one message starts no timer at all. Written in
      `tests/unit/message-banner-timing.test.tsx` rather than the two files named here and in 4.3: the
      dwell and the border are one component's behaviour and splitting them would have duplicated the
      mount harness.

## 4. The border

- [x] 4.1 In `components/overlay/message-banner.tsx`, make the surface classes conditional on
      `bannerBorder`: with it off, drop `overlay-surface`, the rounded frame, the white border and the
      shadow, keeping the width, the row height and the padding so the box the streamer positioned does
      not move.
- [x] 4.2 Apply the same condition in `MessageBannerPreview`, so the Settings editor is typed into on the
      surface the broadcast will show.
- [x] 4.3 With the border on the frame is present; with it off it is absent and the text still renders;
      the banner's width is unchanged between the two. In `tests/unit/message-banner-timing.test.tsx`,
      for the reason given in 3.4.

## 5. The controls

- [x] 5.1 In `app/(app)/live/settings-tab.tsx`, add the global display time and the border toggle to the
      message banner's settings, above the message list, since both describe the banner rather than any
      one message.
- [x] 5.2 Add a per-message time control to each message's existing control row, beside the alignment
      button. It must show that it is unset rather than showing the global's number, or the two states
      the requirement separates would look identical to the streamer.
- [x] 5.3 Clearing the per-message control returns the message to unset, and that must be reachable: a
      control that can only be set is a one-way door.
- [x] 5.4 A half-typed number never reaches a live broadcast. **Done differently from as written.** The
      draft-then-save path in `demo.stores.ts` holds only `draftMessages`, and widening it to a whole
      draft config would have touched every overlay control for this one field. Instead both settings go
      straight into the config like `setFeedSound` beside them — which is what makes their effect visible
      at once, the point of both — and the number input holds its own text locally, calling the store only
      with a value the banner can honour. The per-message time rides the existing message draft already,
      being part of `StripMessage`.

## 6. Land it

- [x] 6.1 `npx tsc --noEmit`, `npm run lint`, and
      `NODE_OPTIONS=--experimental-require-module doppler run -- npx vitest run`.
- [x] 6.2 Run `openspec validate --strict` and archive.
