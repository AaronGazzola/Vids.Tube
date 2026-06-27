## 1. Credential + data model

- [ ] 1.1 Add `YOUTUBE_API_KEY` to Doppler (`dev_personal`); confirm `doppler run -- node -e` can read it
- [ ] 1.2 Create the migration with `npx supabase migration new add_streams_youtube_mapping` (do not hand-create the file)
- [ ] 1.3 In the migration, `alter table public.streams add column youtube_video_id text` and `add column youtube_channel_id text` (both nullable, no default)
- [ ] 1.4 Get owner OK, then `npx supabase db push` (production), then `npm run db:types` to regenerate `supabase/types.ts` (the `Stream` type picks up the new columns)

## 2. Shared read client (`lib/youtube.ts`)

- [ ] 2.1 Port `parseVideoId(urlOrId)` from `../Stream Overlays/lib/youtube.ts` (watch / `youtu.be` / `/live/` / `/shorts/` / `/embed/` / raw 11-char id)
- [ ] 2.2 `fetchVideoData(videoId)`: `GET videos.list?part=statistics,liveStreamingDetails,snippet&id=…&key=…` → `{ likeCount, concurrentViewers, channelId, activeLiveChatId, liveBroadcastContent, title }`
- [ ] 2.3 `fetchSubs(channelId)`: `GET channels.list?part=statistics&id=…&key=…` → `subscriberCount`
- [ ] 2.4 `fetchLiveChatPage(liveChatId, pageToken?)`: `GET liveChatMessages.list?liveChatId=…&part=snippet,authorDetails&pageToken=…&key=…` → `{ messages: { author, authorChannelId, text, publishedAt }[], nextPageToken, pollingIntervalMillis }`
- [ ] 2.5 Read the key from `process.env.YOUTUBE_API_KEY` (throw a clear error if missing); add the new types to `app/layout.types.ts` (`YouTubeVideoData`, `YouTubeChatMessage`)

## 3. Worker chat poller (`worker/lib/youtube-chat.ts`)

- [ ] 3.1 `pollYoutubeChat(liveChatId)`: async generator importing `fetchLiveChatPage` from `@/lib/youtube`, looping over `nextPageToken`, `await`-ing at least `pollingIntervalMillis` between pages
- [ ] 3.2 Yield each message normalized and tagged `origin: 'youtube'`; stop cleanly when the caller breaks (the AZ-112 scoring job is the caller; not built here)
- [ ] 3.3 Resolve `liveChatId` for a stream from `streams.youtube_video_id` via `fetchVideoData` (no-op when absent / not live)

## 4. Studio control (set the YouTube video)

- [ ] 4.1 `app/studio/overlay/page.actions.ts`: `setStreamYoutubeVideoAction(streamId, urlOrId)` (owner-checked) — `parseVideoId`, resolve `channelId` via `fetchVideoData`, write `streams.youtube_video_id`/`youtube_channel_id` with `supabaseAdmin`; and a clear path (empty input → null both)
- [ ] 4.2 `app/studio/overlay/page.hooks.tsx`: `useSetStreamYoutubeVideo` mutation (unwrap `ActionResult`, toast on error); extend `getOverlayContextAction` to return the current `youtube_video_id`
- [ ] 4.3 `app/studio/overlay/page.tsx`: add a minimal "YouTube video URL" input + save/clear bound to the mutation (owner-only page already guarded)

## 5. Verification

- [ ] 5.1 `npx tsc --noEmit` and `npx eslint` pass for `lib/youtube.ts`, `worker/lib/youtube-chat.ts`, the studio files, and `app/layout.types.ts`; `npm run build` compiles
- [ ] 5.2 `scripts/verify-youtube.ts` (`doppler run -- tsx`): given a public video id, print `fetchVideoData` + `fetchSubs`; given a public live broadcast, print a page from `fetchLiveChatPage` — confirms the read layer works with only the API key
- [ ] 5.3 In `/studio/overlay`, set a YouTube video URL on a stream and confirm `streams.youtube_video_id`/`youtube_channel_id` persist (and clear); confirm a non-owner is rejected by the guard
- [ ] 5.4 (deferred — needs the owner's own live simulcast) End-to-end check that the owner's live broadcast resolves `activeLiveChatId` and the poller yields its real chat; track as a Linear verification issue if it can't be run against an arbitrary public live broadcast
