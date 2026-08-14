## 1. The stored shape

- [ ] 1.1 Add `StripMetric = { kind: BannerMetricKind; icon: BannerIconName; color: string }` and
      an optional `metric` to `StripMessage` in `app/(app)/live/demo.types.ts`, with the eight
      metric kinds and the icon names as exported unions.
- [ ] 1.2 Extend `readMessage` so a saved message without a metric loads unchanged and a stored
      metric with an unknown kind or icon degrades rather than dropping the message.
- [ ] 1.3 Create a migration with `npx supabase migration new add_message_banner_metrics` giving
      the first message of every saved layout a members metric with the logo icon, and only
      where that message carries no metric already, so it is idempotent.
- [ ] 1.4 Push the migration and confirm against the real layout that the first message carries
      the member count and no other message gained one.

## 2. Resolving the numbers

- [ ] 2.1 Add `getBannerCountsAction(channelSlug)` to
      `app/(overlay)/overlay/[channelSlug]/page.actions.ts` returning total unique chatters,
      total chat commands and new members this stream, counted on indexed columns.
- [ ] 2.2 Add a matching hook beside `useMemberCount`, polled on the same interval.
- [ ] 2.3 Add `resolveBannerMetrics` to `lib/banner-metrics.ts`, a pure function mapping the goal
      counts, the member count and the new counts onto the eight kinds, returning null for any
      that cannot be resolved.
- [ ] 2.4 Resolve the map once per surface and pass it through `OverlayStageValues`, so the OBS
      route and the Overlays tab cannot compute a number differently.

## 3. Rendering

- [ ] 3.1 Add `components/overlay/banner-icon.tsx` mapping an icon name to its drawing: the
      Vids.Tube logo, the three goal icons lifted from `goal-bar.tsx`, and the curated extras,
      falling back to the logo for an unknown name.
- [ ] 3.2 Change `components/overlay/message-banner.tsx` to draw the showing message's own metric
      and icon rather than the member count, and to give the message the full width when it
      carries none.
- [ ] 3.3 Render nothing at all — no number, no icon — when the metric resolves to null.

## 4. The editor becomes the banner

- [ ] 4.1 Rewrite `app/(app)/live/message-banner-field.tsx` so the contenteditable is the
      banner's message element, inside the banner's real backing at its real proportions, scaled
      to the column.
- [ ] 4.2 Render the message's metric and icon beside the text, outside the editable region, so
      the caret cannot enter them.
- [ ] 4.3 Remove the separate preview from `app/(app)/live/settings-tab.tsx`, since the editable
      surface now is the preview.
- [ ] 4.4 Confirm selection offsets are unaffected by the surrounding scale, since offsets are
      read from text nodes rather than geometry.

## 5. The controls

- [ ] 5.1 Add `react-colorful` and replace the native colour input for message text colour with
      it, applying the colour when the picker settles rather than on every drag step.
- [ ] 5.2 Add the metric checkbox, the metric dropdown and the icon dropdown per message.
- [ ] 5.3 Add a colour control for the icon, using the same picker.

## 6. Prove it

- [ ] 6.1 Add `tests/unit/banner-metrics.test.ts` covering every kind: which source each reads,
      that per-stream kinds resolve to null with no broadcast, and that lifetime kinds do not.
- [ ] 6.2 Add to `tests/unit/message-banner.test.tsx`: a message with a metric renders its number
      and icon, a message without renders neither and takes the full width, an unresolved metric
      renders neither, and an unknown icon name falls back to the logo.
- [ ] 6.3 Extend `tests/unit/demo-layout-version.test.ts` for the new shape: a message without a
      metric loads unchanged, and a stored metric with an unknown kind degrades.
- [ ] 6.4 Extend `tests/e2e/message-banner.spec.ts` to assert a metric reaches the broadcast with
      its icon and colour, and that a message without one takes the full width.
- [ ] 6.5 Add to `tests/e2e/settings-reuse.spec.ts` or a settings spec: typing into the banner
      itself changes the message, and no separate preview is present.

## 7. Land it

- [ ] 7.1 Run `openspec validate --strict` and archive.
