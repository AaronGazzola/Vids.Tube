## Why

The `!me` command (next change) needs each chatter's history on the channel, and
the owner wants that history to reach back through his full YouTube streaming
past — including old unlisted streams. YouTube's official API cannot read ended
streams' chat, but the chat **replay** attached to each VOD can be downloaded
per-video (yt-dlp, one-time, against the owner's own content). This change
builds the archive tables, the backfill script, and the per-chatter aggregates
every identity feature will read.

## What Changes

- **`youtube_vods`**: one row per processed video (video id, title,
  published_at, message count, backfilled_at) making the backfill idempotent —
  already-processed videos are skipped unless `--force`.
- **`youtube_chat_archive`**: one row per replayed chat message — video id,
  YouTube author channel id, author name, message text, published_at, and the
  replay item id (deduped per video) — the raw substrate for any future metric
  (per-stream counts, streaks, most-active stream).
- **`chatter_stats`**: per-author aggregates rebuilt from the archive — latest
  name, total messages, videos attended, first/last seen — keyed by the YouTube
  author channel id (the same id live chat messages carry, so `!me` needs no
  sign-in to match a chatter).
- **`scripts/backfill-youtube-chat.ts`**: gathers video ids from three sources —
  the channel's public uploads (yt-dlp flat playlist), distinct
  `streams.youtube_video_id` values, and the owner-maintained
  `data/youtube-vod-urls.txt` (where unlisted VOD URLs are pasted, since
  unlisted videos cannot be enumerated without channel OAuth) — downloads each
  video's `live_chat` replay JSON with yt-dlp, parses and inserts archive rows,
  records the `youtube_vods` row, then rebuilds `chatter_stats` from the
  archive. Rerunnable at any time to pick up new VODs or newly added URLs.

## Capabilities

### New Capabilities

- `chat-history-index`: the archive tables, the idempotent backfill script with
  its three id sources, and the chatter aggregates.

## Non-goals / Related

- No `!me` command yet (next change reads `chatter_stats`).
- No recurring/automated replay scraping — the script is owner-run, one-shot
  per invocation, against the owner's own videos.
- Enumerating unlisted videos automatically (needs YouTube channel OAuth —
  deferred to the Linear identity ticket); the owner pastes unlisted URLs into
  `data/youtube-vod-urls.txt` instead.
- vids.tube-side history needs no backfill — it already lives in
  `chat_messages`/`viewer_scores`.

## Impact

- New migration: `youtube_vods`, `youtube_chat_archive`, `chatter_stats`
  (owner-only read, service-role writes) + types regen.
- New `scripts/backfill-youtube-chat.ts`; `data/youtube-vod-urls.txt` seeded
  with a comment header.
- Running the backfill against the channel's real public VODs is part of this
  change's verification; unlisted VODs join whenever the owner pastes their
  URLs and reruns.
