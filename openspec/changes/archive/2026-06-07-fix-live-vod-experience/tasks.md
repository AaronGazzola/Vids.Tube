## 1. Channel page live integration

- [x] 1.1 Add an offline/scheduled placeholder component (reuse/rename `components/offline-card.tsx`) that is static, centered, with no chat and no scheduling data
- [x] 1.2 In `app/[channelSlug]/page.tsx`, derive `isLive` from the channel's current stream (`useLiveStream`) and `hls_path`; render `LiveStage` + `LiveChat` in the primary area when live
- [x] 1.3 When not live, render the existing banner/avatar/video-grid with the offline placeholder centered where the player would be, and do NOT mount `LiveChat`
- [x] 1.4 Add any channel-page hooks/actions/types needed to resolve the channel's current stream from the slug (co-located `page.hooks.tsx`/`page.actions.ts`/`page.types.ts`)
- [x] 1.5 Verify chat UI (panel, list, composer) is absent from the DOM when offline and present when live
- [x] 1.6 Redirect `/live` to the owner channel page and remove the standalone live view as the live home (delete or thin out `app/live/page.tsx`, retire `components/live-view.tsx` if unused)
- [x] 1.7 Render the same channel experience at the root home `/` (resolve the owner channel and reuse the shared `ChannelView`), removing the always-on chat surface that `/` previously rendered

## 2. VOD orientation (runtime intrinsic detection)

- [x] 2.1 Surface the `<video>` intrinsic dimensions (`videoWidth`/`videoHeight` on `loadedmetadata`) out of the player via an `onDimensions`/`onLoadedMetadata` callback
- [x] 2.2 In `app/watch/[videoId]/page.tsx`, track runtime dimensions in state; seed the container from stored `videos.width`/`height` for first paint, then prefer runtime values
- [x] 2.3 Render the 9:16 centered container (bounded to 80vh on desktop) when intrinsic `height > width`, else 16:9; ensure a `null`-dim portrait VOD corrects after metadata loads with no reload
- [x] 2.4 Confirm against a known portrait VOD that has `width/height = null` in the DB that it now renders vertical

## 3. VOD chat replay

- [x] 3.1 Add a watch-page server action to fetch the source stream's `started_at` and all `chat_messages` for `video.source_stream_id`, ordered by `created_at`
- [x] 3.2 Add a React Query hook wrapping that action; precompute each message's `offsetMs = max(0, created_at - started_at)`
- [x] 3.3 Build a read-only `ChatReplay` component (no composer) that subscribes to the player's `currentTime` (throttled `timeupdate`) and shows messages with `offsetMs <= currentTimeMs`
- [x] 3.4 Wire player `currentTime`/seek into the replay so seeking re-filters to the correct message set
- [x] 3.5 Show the panel by default when messages exist; add a local dismiss control; hide entirely when no `source_stream_id` or zero messages, leaving the no-replay layout intact

## 4. Rotation-aware recording probe (VM)

- [x] 4.1 Update `scripts/vm/mtx-finalize-vod.sh` to probe rotation (display-matrix `side_data_list` rotation or legacy `tags.rotate`) alongside width/height
- [x] 4.2 Swap width/height when rotation is ±90° so the payload reports display orientation (`height > width` for portrait); keep soft-fail (omit dims, never abort)
- [x] 4.3 Document the probe change in `docs/runbooks/live-streaming-vm.md` and note it only affects VODs recorded after the VM update

## 5. Automated tests

- [x] 5.1 Playwright E2E: channel page renders the offline placeholder with no chat node in the DOM when not live, and renders player + chat when the channel's stream is `live`
- [x] 5.2 Test the watch-page orientation logic: 16:9 for landscape, 9:16 for portrait, and a portrait fixture with stored `width/height = null` that corrects to 9:16 after `loadedmetadata`
- [x] 5.3 Unit-test the chat-replay offset filter (messages with `offsetMs <= currentTimeMs` shown; seek re-filters; negative offsets clamp to 0) and an E2E that the panel is absent when the VOD has no source chat
- [x] 5.4 Run `npm run rls-check`, `npm run vod-ux-check`, `npm run recording-hook-check`, and the Playwright suite; all green
