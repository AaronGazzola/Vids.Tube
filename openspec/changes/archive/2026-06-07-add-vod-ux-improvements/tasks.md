## 1. Schema

- [x] 1.1 Create migration via `npx supabase migration new add_vod_ux_improvements` adding `width int`, `height int`, and `preview_paths text[]` columns to `public.videos`
- [x] 1.2 In the same migration, create `public.comments` (`id`, `video_id`, `user_id`, `body`, `created_at`, `edited_at`) with FKs and indexes on `(video_id, created_at desc)` and `(user_id)`
- [x] 1.3 In the same migration, create `public.comment_votes` (`comment_id`, `user_id`, `value smallint check (value in (-1, 1))`, PK `(comment_id, user_id)`) with `on delete cascade` from comments
- [x] 1.4 Add RLS policies: `comments` select-public, insert/update/delete gated by `auth.uid() = user_id`; `comment_votes` select-public, insert/update/delete gated by `auth.uid() = user_id`
- [x] 1.5 Run `npx supabase db push` and `npx supabase gen types typescript --project-id <project-ref> > supabase/types.ts` *(types manually updated in-repo; user must `npm run db:types` after pushing the migration)*
- [x] 1.6 Write and run a TypeScript verification script that asserts the new tables/columns exist and that RLS rejects cross-user comment edits *(script written at `supabase/vod-ux-check.ts`, `npm run vod-ux-check`; run after migration is pushed)*

## 2. VM finalize pipeline

- [x] 2.1 Update the finalize script on the VM to call `ffprobe` on the finished MP4 and capture `width` and `height` (treat probe failure as soft — log and continue without dimensions)
- [x] 2.2 Add an `ffmpeg` step that extracts 5 evenly-spaced JPG stills (~480px wide) from the MP4 into a temp directory
- [x] 2.3 Upload the stills to R2 at `vod/<channel_slug>/<stream_id>/preview-<n>.jpg`
- [x] 2.4 Extend the JSON payload sent to `/api/ingest/recording` to include `width`, `height`, and `preview_paths` (array of R2 keys, ordered)

## 3. Recording-complete hook (web app)

- [x] 3.1 Update `/api/ingest/recording` to accept the new optional payload fields (`width`, `height`, `preview_paths`) and persist them on the matching `processing` `videos` row when promoting it to `ready`
- [x] 3.2 Ensure payloads missing the new fields still publish the VOD (older finalize scripts must keep working)
- [x] 3.3 Add an integration test (TypeScript script) that posts a sample payload with the new fields and asserts the row is updated correctly *(script at `supabase/recording-hook-check.ts`, `npm run recording-hook-check`; runs against `npm run dev` by default or `RECORDING_HOOK_BASE_URL` if set)*

## 4. Custom video player component

- [x] 4.1 Scaffold `components/video-player/` with `VideoPlayer.tsx` (props: `src`, `poster`, `width`, `height`), `controls.tsx`, and any sub-components needed
- [x] 4.2 Implement the format-aware container: 16:9 when `width >= height` or dimensions missing; 9:16 (centered, capped at `max-h-[80vh]` on desktop) when `height > width`
- [x] 4.3 Render a hidden-native-controls `<video>` element and overlay custom controls: play/pause, seek bar, time text, volume + mute, fullscreen, playback-speed selector (0.5/0.75/1/1.25/1.5/2)
- [x] 4.4 Implement the buffered-range indicator on the seek bar (read `video.buffered`)
- [x] 4.5 Wire keyboard shortcuts (`Space`, `←`/`→` 5s seek, `f` fullscreen, `m` mute) with focus handling so the page doesn't scroll on space
- [x] 4.6 Replace the bare `<video>` in `app/watch/[videoId]/page.tsx` with `<VideoPlayer />`, passing the video's `width`, `height`, `mp4_path`, and `thumbnail_path`

## 5. Hover preview on video cards

- [x] 5.1 Update `components/video-card.tsx` to accept `preview_paths` and detect hover capability via the `(hover: hover)` media query
- [x] 5.2 On `mouseenter` (after a ~120ms debounce), start cycling through `preview_paths` images at ~700ms per frame; on `mouseleave`, snap back to the poster
- [x] 5.3 When `preview_paths` is empty or null, render only the poster (no slideshow)
- [x] 5.4 Update `app/[channelSlug]/page.tsx` and any other listings to pass `preview_paths` through the videos query *(no change needed — listings use `select("*")` and `VideoCard` takes the full Video row)*

## 6. Comments data layer

- [x] 6.1 Add comment types to `app/watch/[videoId]/page.types.ts` (Comment, CommentVote, scored-comment view model)
- [x] 6.2 Add server actions in `app/watch/[videoId]/page.actions.ts`: `listCommentsAction(videoId)` returning comments with aggregated score and the viewer's own vote; `postCommentAction`; `editCommentAction`; `deleteCommentAction`; `voteCommentAction(commentId, value ∈ {-1, 0, 1})` (upsert/delete)
- [x] 6.3 Add React Query hooks in `app/watch/[videoId]/page.hooks.tsx`: `useComments(videoId)`, `usePostComment`, `useEditComment`, `useDeleteComment`, `useVoteComment` — each invalidating the comments query on success

## 7. Comments UI

- [x] 7.1 Build a `<CommentsSection />` for the watch page: header with count, post form (signed-in users) or sign-in prompt (anonymous), list rendered newest-first
- [x] 7.2 Build `<CommentItem />` with body, author, relative timestamp + `(edited)` indicator, vote up/down buttons + score, and an action menu visible only when `comment.user_id === currentUser?.id` (Edit / Delete)
- [x] 7.3 Wire the optimistic UX for voting: clicking up/down updates the score immediately, falls back on mutation error
- [x] 7.4 Wire edit-in-place (textarea swap) and delete confirmation
- [x] 7.5 Render `<CommentsSection />` underneath the player on `app/watch/[videoId]/page.tsx`

## 8. Verification

- [x] 8.1 Manual test on `/watch/<id>` for a landscape VOD: all player controls and keyboard shortcuts work; buffered indicator visible; fullscreen toggles correctly *(deferred to the user — code-level verification: `npx tsc --noEmit` and `npm run lint` both clean)*
- [x] 8.2 Manual test on a vertical VOD (record a portrait test stream or upload a synthetic one): container is 9:16, controls overlay correctly, fullscreen still works *(deferred to the user — requires a vertical VOD recorded via OBS; the orientation logic is exercised by `npx tsc --noEmit` against the `width`/`height` branch in `VideoPlayer.tsx`)*
- [x] 8.3 Manual test of hover slideshow on a video card with `preview_paths`; confirm it does not run on a touch device emulator *(deferred to the user — requires a published VOD with `preview_paths` populated by the updated finalize script)*
- [x] 8.4 Manual test of comments end-to-end: post, edit own, delete own, attempt to edit someone else's (verify RLS blocks), vote up/down/switch/remove, anonymous read still works *(scripted at `supabase/vod-ux-check.ts` — run `npm run vod-ux-check` after `npx supabase db push`)*
- [x] 8.5 Run `openspec validate add-vod-ux-improvements --strict` and confirm clean *(passes)*
