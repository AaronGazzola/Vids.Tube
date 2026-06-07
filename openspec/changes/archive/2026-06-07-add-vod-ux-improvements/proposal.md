## Why

The current VOD watch experience is bare-bones: a native `<video>` element in a
fixed 16:9 box and no way for viewers to engage with a video. Thumbnails are
static. This makes the v1 product feel less alive than it needs to be even at
the small audience scale, and — more importantly — vertical content (the
short-clip format the v2 roadmap calls for) is letterboxed inside a landscape
box today, which is not the experience anyone wants.

This change closes three gaps at once: viewer engagement (comments + voting),
discovery affordance (hover previews on thumbnails), and a player that respects
the video's native aspect ratio. They share the same touched surface (the
watch page, the video card, the videos row + finalize pipeline), so bundling
them avoids three separate migrations and three round-trips through the VM
finalize script.

## What Changes

- **Comments on the watch page**, with up/down voting, owner-only edit/delete,
  newest-first ordering. Anonymous read; authenticated write.
- **Hover-preview thumbnails** via a screenshot slideshow (4–6 stills extracted
  in the existing finalize ffmpeg pass, cycled on `mouseenter`). Degrades to the
  static poster on touch devices.
- **Custom video player** on `/watch/[videoId]` that reads each video's native
  `width`/`height` and renders **vertical content in a 9:16 phone-shaped
  container** rather than letterboxing it into 16:9.
- **Pipeline extension**: the finalize script ffprobes width/height and
  ffmpeg-extracts the preview stills; the `/api/ingest/recording` hook accepts
  and persists the new fields.
- **Schema additions**: `videos.width`, `videos.height`, `videos.preview_paths`;
  new `comments` and `comment_votes` tables with RLS.

Out of scope (called out so they don't creep in):
- Nested comment replies / threading.
- Comment moderation tooling (report, hide, shadow-ban).
- Real video-clip hover previews (the YouTube-style short MP4) — explicitly
  chosen against for v1 in favor of the cheaper slideshow.
- HLS / ABR playback — still MP4-only in v1.
- Captions, chapters, quality picker.

## Capabilities

### New Capabilities

- `vod-comments`: viewer comments on a VOD, with per-comment up/down votes, a
  derived score, and owner-only edit/delete. Read by anyone; write by signed-in
  users only.

### Modified Capabilities

- `vod-playback`: extends the playback requirements with the custom player,
  format-aware container (vertical vs landscape), and hover-preview behavior on
  video cards.
- `vod-recording`: extends the finalize/publish pipeline to also capture video
  dimensions and produce preview stills, and persist them through the
  recording-complete hook.

## Impact

- **DB / migrations**:
  - New tables: `comments`, `comment_votes` with RLS policies.
  - New columns on `videos`: `width int`, `height int`, `preview_paths text[]`.
  - Regenerate `supabase/types.ts`.
- **Pipeline (Hetzner VM)**: the finalize script that produces the MP4 +
  thumbnail learns to (a) `ffprobe` width/height and (b) extract N evenly-spaced
  stills via `ffmpeg`, uploading them to R2 under deterministic keys; the
  shared-secret `/api/ingest/recording` payload gains `width`, `height`, and
  `preview_paths`.
- **App code**:
  - `app/watch/[videoId]/page.tsx` swaps the native `<video>` for a new
    `components/video-player/` component tree.
  - `components/video-card.tsx` gains hover-cycling preview behavior.
  - New `app/watch/[videoId]/comments/` (or co-located `page.comments.*` files,
    per the file-organization conventions) for the comments UI, hooks, actions,
    and types.
- **Out of scope (no impact)**: `app/live/*`, the live chat path, the credit
  ledger, and the auth flow are not touched.
