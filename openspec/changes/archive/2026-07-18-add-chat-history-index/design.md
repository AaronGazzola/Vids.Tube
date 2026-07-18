## Context

yt-dlp downloads a VOD's chat replay as a `.live_chat.json` sidecar
(`--skip-download --write-subs --sub-langs live_chat`): JSON-lines, each line a
`replayChatItemAction` whose `addChatItemAction.item.liveChatTextMessageRenderer`
carries `id`, `timestampUsec`, `authorExternalChannelId`,
`authorName.simpleText`, and `message.runs[]` (text and emoji runs). Unlisted
videos download fine by URL; they just cannot be listed. The platform has one
owner channel, so the archive tables are global (no channel scoping).

## Goals / Non-Goals

- Goals: lossless raw archive (any later metric derivable), idempotent reruns,
  chatter aggregates keyed by the same author channel id live chat provides.
- Non-goals: automated recurring scraping; sentiment or scoring of history.

## Decisions

- **Tables** (owner-only select via the owner-channel EXISTS pattern;
  service-role writes):
  - `youtube_vods`: `video_id text pk`, `title text`, `published_at
    timestamptz`, `message_count int not null default 0`, `backfilled_at
    timestamptz not null default now()`.
  - `youtube_chat_archive`: `id uuid pk default gen_random_uuid()`, `video_id
    text not null references youtube_vods on delete cascade`, `message_id text
    not null`, `author_channel_id text not null`, `author_name text`, `body text
    not null`, `published_at timestamptz not null`, unique `(video_id,
    message_id)`; index on `author_channel_id`.
  - `chatter_stats`: `author_channel_id text pk`, `author_name text`,
    `total_messages int not null`, `videos_attended int not null`,
    `first_seen_at timestamptz`, `last_seen_at timestamptz`, `updated_at
    timestamptz not null default now()`.
- **Id sources** (in `backfill-youtube-chat.ts`):
  1. Public uploads: `yt-dlp --flat-playlist --print id
     https://www.youtube.com/channel/<id>` — the channel id comes from the most
     recent non-null `streams.youtube_channel_id`, falling back to resolving a
     known `streams.youtube_video_id` via `fetchVideoData`.
  2. Distinct non-null `streams.youtube_video_id`.
  3. `data/youtube-vod-urls.txt`: one URL or video id per line, `#` comments;
     parsed with `parseVideoId` from `lib/youtube.ts`.
- **Per-video flow**: skip when `youtube_vods` has the id (unless `--force`);
  run yt-dlp into a temp dir writing `live_chat.json` + `info.json`; a video
  with no chat replay (yt-dlp reports no subtitles) still gets a `youtube_vods`
  row with `message_count 0` so it is not retried every run; parse JSON lines →
  rows `{ message_id, author_channel_id, author_name, body, published_at:
  timestampUsec/1000 }` (text = concat of `runs[].text` plus emoji shortcuts /
  `emoji.emojiId` fallback); insert in batches of 500 with
  `on conflict (video_id, message_id) do nothing`; write the `youtube_vods` row
  with the count and title.
- **Aggregates**: after all videos, `chatter_stats` is fully rebuilt from the
  archive in one pass (group by `author_channel_id`: count, distinct videos,
  min/max `published_at`, latest name by `published_at`), upserted, and rows for
  authors no longer present are deleted. Full rebuild keeps every future metric
  change a one-liner; scale (thousands of rows) makes this cheap.
- **Binary**: `YTDLP_BIN` env override, default `yt-dlp` on PATH. yt-dlp
  invocations use `execFile` (no shell), continue-on-error per video with a
  summary of failures at the end.

## Risks / Trade-offs

- Very old streams may have no chat replay (feature-gated historically or
  replay disabled) — recorded as zero-message VODs, reported in the summary.
- Chat replay download uses YouTube's private endpoints via yt-dlp — accepted
  for a one-time, owner-run pass over the owner's own content; never scheduled.
- Author display names change over time; `chatter_stats.author_name` keeps the
  most recent, and the archive keeps every historical name.
