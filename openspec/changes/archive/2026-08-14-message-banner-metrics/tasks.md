## 1. The stored shape

- [x] 1.1 Add `StripMetric = { kind: BannerMetricKind; icon: BannerIconName; color: string }` and
      an optional `metric` to `StripMessage` in `app/(app)/live/demo.types.ts`, with the eight
      metric kinds and the icon names as exported unions.
- [x] 1.2 Extend `readMessage` so a saved message without a metric loads unchanged and a stored
      metric with an unknown kind or icon degrades rather than dropping the message.
- [x] 1.3 Create a migration with `npx supabase migration new add_message_banner_metrics` giving
      the first message of every saved layout a members metric with the logo icon, and only
      where that message carries no metric already, so it is idempotent.
- [x] 1.4 Push the migration and confirm against the real layout that the first message carries
      the member count and no other message gained one.

## 2. Resolving the numbers

- [x] 2.1 Add `getBannerCountsAction(channelSlug)` to
      `app/(overlay)/overlay/[channelSlug]/page.actions.ts` returning total unique chatters,
      total chat commands and new members this stream, counted on indexed columns.
- [x] 2.2 Add a matching hook beside `useMemberCount`, polled on the same interval.
- [x] 2.3 Add `resolveBannerMetrics` to `lib/banner-metrics.ts`, a pure function mapping the goal
      counts, the member count and the new counts onto the eight kinds, returning null for any
      that cannot be resolved.
- [x] 2.4 Resolve the map once per surface and pass it through `OverlayStageValues`, so the OBS
      route and the Overlays tab cannot compute a number differently.

## 3. Rendering

- [x] 3.1 Add `components/overlay/banner-icon.tsx` mapping an icon name to its drawing: the
      Vids.Tube logo, the three goal icons lifted from `goal-bar.tsx`, and the curated extras,
      falling back to the logo for an unknown name.
- [x] 3.2 Change `components/overlay/message-banner.tsx` to draw the showing message's own metric
      and icon rather than the member count, and to give the message the full width when it
      carries none.
- [x] 3.3 Render nothing at all — no number, no icon — when the metric resolves to null.

## 4. The editor becomes the banner

- [x] 4.1 Rewrite `app/(app)/live/message-banner-field.tsx` so the contenteditable is the
      banner's message element, inside the banner's real backing at its real proportions, scaled
      to the column.
- [x] 4.2 Render the message's metric and icon beside the text, outside the editable region, so
      the caret cannot enter them.
- [x] 4.3 Remove the separate preview from `app/(app)/live/settings-tab.tsx`, since the editable
      surface now is the preview.
- [x] 4.4 Confirm selection offsets are unaffected by the surrounding scale, since offsets are
      read from text nodes rather than geometry.

## 5. The controls

- [x] 5.1 Add `react-colorful` and replace the native colour input for message text colour with
      it, applying the colour when the picker settles rather than on every drag step.
- [x] 5.2 Add the metric checkbox, the metric dropdown and the icon dropdown per message.
- [x] 5.3 Add a colour control for the icon, using the same picker.

## 6. Prove it

- [x] 6.1 Add `tests/unit/banner-metrics.test.ts` covering every kind: which source each reads,
      that per-stream kinds resolve to null with no broadcast, and that lifetime kinds do not.
- [x] 6.2 Add to `tests/unit/message-banner.test.tsx`: a message with a metric renders its number
      and icon, a message without renders neither and takes the full width, an unresolved metric
      renders neither, and an unknown icon name falls back to the logo.
- [x] 6.3 Extend `tests/unit/demo-layout-version.test.ts` for the new shape: a message without a
      metric loads unchanged, and a stored metric with an unknown kind degrades.
- [x] 6.4 Extend `tests/e2e/message-banner.spec.ts` to assert a metric reaches the broadcast with
      its icon and colour, and that a message without one takes the full width.
- [x] 6.5 Added to `tests/e2e/settings-reuse.spec.ts`: typing into the banner changes the
      message, the metric controls add and remove a number, and reloading discards it since
      nothing is saved until Save changes.

## 7. Land it

- [x] 7.1 Run `openspec validate --strict` and archive.

## 8. Found while building

- [x] 8.1 The default layout gained the members metric on its one message. The migration gave
      every saved layout its count back, but the code default did not, so a channel with no
      saved layout would have been the only one starting with no number.
- [x] 8.2 Total subs resolves to nothing off air, despite being a lifetime figure, because the
      subscriber count is read from YouTube as part of the goal poll and polling it while
      nothing is live would spend the daily quota on a banner nobody is watching. The spec now
      says so rather than promising every lifetime metric survives being off air.
