## Context

The v1 MVP is live with a basic VOD path: the finalize script on the Hetzner VM
remuxes a recorded stream into MP4, pulls a single poster thumbnail, uploads
both to R2, and `/api/ingest/recording` flips a `videos` row to `ready` with
`mp4_path`, `thumbnail_path`, and `duration_s`. Anonymous viewers play it via a
bare `<video controls>` element on `/watch/[videoId]`.

Three constraints shape the design space for this change:

1. **The pipeline runs once per VOD on the VM.** Any media derived from the
   recording (stills, dimensions) is cheapest to compute in the same
   `runOnNotReady` script that already produces the MP4 — we already pay the
   disk-read cost there. Doing it at request time, or as a separate worker, is
   strictly more complex.
2. **R2 egress is free; storage is not.** Storing a few extra 240px JPGs per
   VOD is negligible (~50 KB × 5 = 250 KB/video). Storing a separately encoded
   preview *clip* (~1–3 MB) is fine at MVP scale but not for free as catalog
   grows, and the encode cost on the VM is real.
3. **No middleware, RLS for everything, all writes via React Query → server
   actions.** Comments are the first user-writable surface in the app beyond
   auth; the policies and the read/write split must be designed deliberately.

## Goals / Non-Goals

**Goals:**
- Comments with a small, predictable surface: post / edit own / delete own /
  vote up / vote down / change vote / remove vote. Anonymous read.
- A video player that respects each video's native orientation, with a
  controls UI we own (so future additions like chapters/quality picker have a
  home).
- Hover previews that *feel alive* without adding a second encode pass.
- One round-trip of pipeline changes (one finalize-script edit, one
  recording-hook payload bump) rather than three.

**Non-Goals:**
- Real video-clip previews (a separately encoded short MP4 like YouTube's). The
  pipeline complexity is disproportionate to v1 needs; revisit when shorts ship
  in v2.
- Threaded/nested replies, mentions, reactions beyond up/down.
- Moderation tools (report, hide, flag). The owner is the only creator in v1.
- HLS, ABR, captions, chapters, picture-in-picture. The player is designed to
  *accommodate* these later but does not implement them.
- Realtime comment updates. v1 uses `useQuery` + manual refetch on
  post/edit/delete; Realtime can come later by swapping the data layer.

## Decisions

### Decision 1: Screenshot slideshow, not video clip, for hover previews

We extract 4–6 evenly-spaced still frames in the finalize ffmpeg pass and store
their R2 keys on `videos.preview_paths` (a `text[]`). The `VideoCard` cycles
through them on `mouseenter` (300 ms per frame) and snaps back to the poster on
`mouseleave`.

**Why over a video-clip preview:**
- One ffmpeg invocation (`-vf fps=…,scale=…` with `-vframes N`) versus a
  multi-pass scene-detect + concat + re-encode for a real preview clip.
- ~250 KB total storage per VOD vs ~2 MB.
- No additional decode/playback complexity in the card — just `<img>` swapping.
- On touch devices, where hover doesn't exist, the slideshow naturally
  degenerates to the static poster without a separate code path.
- We retain the option to add real video previews later as a *new* column
  (`preview_clip_path`); cards prefer the clip when present, fall back to the
  slideshow.

**Alternative considered:** generate the preview clip on first user hover
(server-side, lazily). Rejected: latency on first-hover is bad UX, and it
introduces a synchronous fan-out from the web tier to the VM which we have
otherwise avoided.

### Decision 2: Orientation captured at finalize, not inferred at play

We add `videos.width int` and `videos.height int`, populated by an `ffprobe`
call in the finalize script alongside the existing duration. The player picks
its container by comparing them: `height > width` ⇒ vertical container,
otherwise landscape.

**Why over inferring client-side:**
- Knowing dimensions *before* the `<video>` element resolves metadata lets the
  page reserve the correct layout space immediately, avoiding a layout shift
  when the metadata loads.
- The values are needed in the listing (a vertical card might want different
  treatment in a future grid layout) where the `<video>` element isn't mounted.
- ffprobe in the finalize step is a free addition — the script already shells
  out to ffmpeg.

**Alternative considered:** infer via `loadedmetadata` on the client. Rejected
for the layout-shift reason above and because it pushes orientation handling
into the player component, which other surfaces (cards, future shorts feed)
also need.

### Decision 3: Custom player wraps native `<video>`, no third-party lib

`components/video-player/` exposes a `<VideoPlayer />` component that renders
its own controls UI in a portal over a hidden-native-controls `<video>`
element. It uses the native HTML5 element for actual playback, MSE, and seek;
we own only the controls layer.

**Why over Video.js / Vidstack / Plyr:**
- v1 plays plain MP4 — no DRM, no HLS, no ABR. The third-party libs' value is
  precisely those features we don't need.
- Custom controls give us pixel-level control over the vertical layout
  (controls sit on top of a 9:16 frame, not below a 16:9 container).
- Bundle size: a hand-rolled controls layer is ~3 KB minified vs ~50 KB+ for
  any of the libs.
- We accept that we will need to reconsider when HLS/ABR lands; the player's
  API is designed to absorb that change (an underlying `<video>` element is
  still the playback substrate even with hls.js).

**Trade-off accepted:** we will write our own seek bar, buffered-range
indicator, volume slider, fullscreen handling, and keyboard shortcuts. This is
~150 lines of careful but standard React.

### Decision 4: Vertical container is 9:16 with `max-h-[80vh]` on desktop

Landscape: `aspect-video` inside `max-w-5xl` (matches the current page).
Vertical: `aspect-[9/16]` inside `max-w-[min(420px,80vh*9/16)]`, centered.

This prevents a vertical video from taking the full viewport height on a tall
laptop screen, where it would feel comically narrow. On mobile, both formats
fill the viewport width naturally.

### Decision 5: Comments schema — votes are a separate row, score is derived

```
comments       (id, video_id, user_id, body, created_at, edited_at)
comment_votes  (comment_id, user_id, value smallint check (value in (-1, 1)),
                PRIMARY KEY (comment_id, user_id))
```

Score is computed via a view or an aggregated `select` in the action, not
denormalized onto `comments`.

**Why over a denormalized `score int` on comments:**
- v1 traffic is well under 10 concurrent viewers; aggregation cost is
  irrelevant.
- Denormalization needs triggers or transactional updates on every vote
  toggle; bugs there create score drift that is hard to reconcile.
- We can denormalize later (with `pg_cron` rebuild for safety) if the
  aggregation ever shows up in pg_stat_statements.

**RLS:**
- `comments`: `select` = public; `insert` requires `auth.uid() = user_id`;
  `update` requires `auth.uid() = user_id`; `delete` requires
  `auth.uid() = user_id`.
- `comment_votes`: `select` = public (for score aggregation); `insert/update/
  delete` require `auth.uid() = user_id`.

### Decision 6: Vote action is upsert-and-toggle, single round-trip

The vote action takes `(comment_id, value)` where `value ∈ {-1, 0, 1}`. The
server action upserts on the composite PK; `value = 0` deletes the row. This
collapses up/down/switch/remove into one mutation rather than four endpoints.

## Risks / Trade-offs

- **Vertical-player CSS edge cases on rotated mobile devices** → Mitigate by
  always sizing the container off `aspect-ratio` rather than absolute pixels;
  test on iOS Safari (landscape orientation lock) and Android Chrome.
- **ffprobe failures on the VM block VOD publication** → The finalize script
  must treat ffprobe failure as soft: log + omit width/height but still call
  the recording hook so the VOD becomes `ready`. Player falls back to 16:9
  when dimensions are missing.
- **Spam comments with no moderation** → Owner is the only creator in v1 and
  there is no public-facing audience yet. Accept the risk; revisit before any
  public launch.
- **Score-drift if `comment_votes` ever gets out of sync** → Score is derived,
  so this can't happen until we denormalize. Carry the risk forward to that
  future change.
- **Hover slideshow flashing on fast pointer pass-by** → Add a small
  `mouseenter` debounce (~120 ms) before starting the cycle so a pointer
  passing through doesn't strobe four images.

## Migration Plan

1. **Schema migration** (one file): create `comments`, `comment_votes`, RLS
   policies; add `width`, `height`, `preview_paths` to `videos`. Push with
   `npx supabase db push` and regenerate `supabase/types.ts`.
2. **Pipeline update**: edit the VM's finalize script to call ffprobe and
   ffmpeg-extract stills; update the `/api/ingest/recording` route to accept
   the new payload fields. Existing VODs simply have `null` width/height and
   empty `preview_paths`; the UI handles that.
3. **App code**: ship the new player component and comments UI behind the
   normal `next dev`/Vercel preview flow. There is no feature flag — v1 is
   single-tenant and the owner can verify on their own data.
4. **Backfill** *(optional)*: a one-off script can re-ffprobe / re-extract
   stills for already-published VODs by downloading the MP4 from R2, running
   the same ffmpeg commands locally, and re-uploading. Not required for the
   change to ship.

**Rollback**: the player swap is a pure component change — revert the PR. The
schema additions are nullable / nullable-array columns and additive tables;
they can be left in place even on rollback.
