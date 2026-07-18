## 1. Data model

- [x] 1.1 Migration (`npx supabase migration new add_chat_history_index`):
  `youtube_vods` (video_id pk, title, published_at, message_count default 0,
  backfilled_at default now()), `youtube_chat_archive` (id pk, video_id →
  youtube_vods cascade, message_id, author_channel_id, author_name, body,
  published_at, unique (video_id, message_id), index author_channel_id),
  `chatter_stats` (author_channel_id pk, author_name, total_messages,
  videos_attended, first_seen_at, last_seen_at, updated_at); RLS owner-only
  select on all three (owner-channel EXISTS), no client writes
- [x] 1.2 Push migration (`doppler run -- npx supabase db push`) and regen
  `supabase/types.ts`

## 2. Backfill script

- [x] 2.1 `data/youtube-vod-urls.txt` with a comment header explaining it holds
  unlisted VOD URLs (one per line, `#` comments)
- [x] 2.2 `scripts/backfill-youtube-chat.ts`: id gathering (public uploads via
  `yt-dlp --flat-playlist --print id` on the channel resolved from
  `streams.youtube_channel_id` or via `fetchVideoData`; distinct
  `streams.youtube_video_id`; parsed lines of `data/youtube-vod-urls.txt`),
  per-video yt-dlp replay download into a temp dir, JSON-lines parsing
  (`liveChatTextMessageRenderer` → message_id/author/body/published_at from
  timestampUsec, emoji runs included), batched inserts with
  `on conflict do nothing`, `youtube_vods` upsert with count/title, `--force`
  reprocessing flag, continue-on-error with an end-of-run summary, and the full
  `chatter_stats` rebuild (group-by over the archive, upsert, delete stale rows);
  `YTDLP_BIN` override, default `yt-dlp`
- [x] 2.3 npm script `backfill:youtube-chat` in package.json
  (`doppler run -- tsx scripts/backfill-youtube-chat.ts`)

## 3. Verify

- [x] 3.1 `npx tsc --noEmit`, `npm run lint` clean
- [x] 3.2 Run the real backfill (`npm run backfill:youtube-chat`) against the
  channel's discoverable VODs; assert non-zero archived messages, matching
  `youtube_vods.message_count` sums, and consistent `chatter_stats` totals
  (script prints the summary; a follow-up query cross-checks
  sum(total_messages) = count(archive rows))
- [x] 3.3 Rerun the script and assert it skips all processed videos (idempotent:
  second-run summary shows 0 new messages)
- [x] 3.4 `npx openspec validate add-chat-history-index --strict`
