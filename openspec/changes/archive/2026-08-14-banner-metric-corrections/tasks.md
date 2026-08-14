## 1. Absence is drawn

- [x] 1.1 In `components/overlay/message-banner.tsx`, render the metric block whenever the
      message carries one, showing an em dash where the number is null and the icon either way.
- [x] 1.2 Keep the full-width behaviour for a message carrying no metric at all, which is a
      different thing from a metric with no number.

## 2. The commands metric becomes per-broadcast

- [x] 2.1 Rename the kind from `totalCommands` to `commandsThisStream` in
      `app/(app)/live/demo.types.ts`, with the label "Chat commands this stream". A saved message
      carrying the old kind already degrades to no metric, since `readMetric` drops a kind it
      does not know.
- [x] 2.2 Count `command_events` for the live stream rather than for the channel in
      `getBannerCountsAction`, returning null when nothing is live.

## 3. Chats this stream

- [x] 3.1 Add the kind `chatsThisStream` with the label "Chats this stream".
- [x] 3.2 Count `chat_messages` for the live stream in `getBannerCountsAction`, on the existing
      `(stream_id, created_at)` index, returning null when nothing is live.
- [x] 3.3 Map both new kinds in `lib/banner-metrics.ts`.

## 4. Prove it

- [x] 4.1 Update `tests/unit/banner-metrics.test.ts` for the nine kinds, asserting the two
      per-broadcast counts resolve to null off air.
- [x] 4.2 Update `tests/unit/message-banner.test.tsx`: an unresolved metric draws its icon and a
      dash, and a message with no metric still draws neither.
- [x] 4.3 Update the demo values and the editor test that asserted a missing metric drew nothing.

## 5. Land it

- [x] 5.1 Run `openspec validate --strict` and archive.
