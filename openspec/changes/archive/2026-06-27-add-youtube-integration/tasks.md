## 1. Credential + data model

- [x] 1.1 Add `YOUTUBE_API_KEY` to Doppler; confirm a script can read it (owner added it to the `dev_personal` config — see note in 5.x about the active `prd` config)
- [x] 1.2 Create the migration with `npx supabase migration new add_streams_youtube_mapping` (do not hand-create the file)
- [x] 1.3 In the migration, `alter table public.streams add column youtube_video_id text` and `add column youtube_channel_id text` (both nullable, no default)
- [x] 1.4 Get owner OK, then `npx supabase db push` (production), then `npm run db:types` to regenerate `supabase/types.ts` (the `Stream` type picks up the new columns)

## 2. Shared read client (`lib/youtube.ts`)

- [x] 2.1 Port `parseVideoId(urlOrId)` from `../Stream Overlays/lib/youtube.ts` (watch / `youtu.be` / `/live/` / `/shorts/` / `/embed/` / raw 11-char id)
- [x] 2.2 `fetchVideoData(videoId)`: `videos.list?part=statistics,liveStreamingDetails,snippet` → `{ likeCount, concurrentViewers, channelId, activeLiveChatId, liveBroadcastContent, title }`
- [x] 2.3 `fetchSubs(channelId)`: `channels.list?part=statistics` → `subscriberCount`
- [x] 2.4 `fetchLiveChatPage(liveChatId, pageToken?)`: `liveChat/messages?part=snippet,authorDetails` → `{ messages: { author, authorChannelId, text, publishedAt }[], nextPageToken, pollingIntervalMillis }`
- [x] 2.5 Read the key from `process.env.YOUTUBE_API_KEY` (throw if missing); add `YouTubeVideoData`/`YouTubeChatMessage`/`YouTubeChatPage` to `app/layout.types.ts`

## 3. Worker chat poller (`worker/lib/youtube-chat.ts`)

- [x] 3.1 `pollYoutubeChat(liveChatId)`: async generator importing `fetchLiveChatPage` from `@/lib/youtube`, looping over `nextPageToken`, `await`-ing at least `pollingIntervalMillis` between pages
- [x] 3.2 Yield each message normalized and tagged `origin: 'youtube'`; stop cleanly when the chat ends or the caller breaks (the AZ-112 scoring job is the caller; not built here)
- [x] 3.3 `resolveLiveChatId(youtubeVideoId)` via `fetchVideoData` (returns null when absent / not live)

## 4. Studio control (set the YouTube video)

- [x] 4.1 `app/studio/overlay/page.actions.ts`: `setStreamYoutubeVideoAction(streamId, urlOrId)` (owner-checked) — `parseVideoId`, resolve `channelId` via `fetchVideoData`, write `streams.youtube_video_id`/`youtube_channel_id`; empty input → clears both to null
- [x] 4.2 `app/studio/overlay/page.hooks.tsx`: `useSetStreamYoutubeVideo` mutation (unwrap `ActionResult`, toast); `getOverlayContextAction` now returns `youtubeVideoId`
- [x] 4.3 `app/studio/overlay/page.tsx`: "YouTube broadcast" card with a video-URL input + Save/Clear bound to the mutation (owner-only page already guarded)

## 5. Verification

- [x] 5.1 `npx tsc --noEmit`, `npx eslint`, and `npm run build` all pass for the new files
- [x] 5.2 `scripts/verify-youtube.ts` (`doppler run -- tsx`) verified BOTH halves with only the API key: metrics against a public video (real likes/subs/viewers), and chat against a found public live broadcast (`activeLiveChatId` resolved, a page of real messages + avatars + `pollingIntervalMillis` returned)

Owner-run verification (studio set/clear in-browser + own live simulcast, plus the `prd` vs `dev_personal` Doppler config note) is tracked in **AZ-126** — out of this change per governance (not buildable here).
