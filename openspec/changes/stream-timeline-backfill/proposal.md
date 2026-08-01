## Why

Every finished stream already holds a transcript and both origins' chat, but nothing
says *what happened when*. Finding a funny exchange, a topic shift, or a moment worth
clipping means scrubbing a two-hour VOD. Shorts curation (AZ-120/AZ-121/AZ-122) and
chapters (AZ-192) are both blocked on the same missing layer: a labelled, scored,
VOD-timestamped index of stream content. This change builds that layer for the
existing back catalogue and gives the owner a surface to review its quality, so the
live-time version (AZ-206's worker + `/live` Timeline tab) can be specced against
output that has already been judged on real streams.

## What Changes

- **New timeline model**: overlapping `stream_sections` (a span about one thing) and
  point `stream_moments` (something specific happened), both stream-relative,
  labelled, tagged, and scored 0-100 on humour / interest / engagement in a `scores`
  jsonb column so new criteria need no migration.
- **Sections may overlap and nest.** The model does not force a single flat partition:
  a 40-minute "debugging the deploy" section can contain a 6-minute "argument about
  mustaches", and both are real rows.
- **Chapters are produced in the same pass**: a third array giving one flat,
  non-overlapping spine over the VOD, stored in `stream_chapters` with `status`
  defaulting to `suggested`. The expensive part of AZ-192 is reading every VOD's
  transcript, which this pass already does; asking for the spine here costs about 0.08M
  extra tokens instead of a second full sweep later. The chapters *feature* — the
  per-channel auto-apply setting, the approve UI, and the public seekbar rendering —
  stays in AZ-192.
- **New backfill job** (`scripts/backfill-stream-timeline.ts`): for one stream or a
  batch, read its transcript (live `transcript_segments` preferred, else
  `youtube_transcripts`) plus its chat from both origins, make **one** `claude -p`
  call per stream, and write sections + moments. Idempotent, resumable, and driven by
  `--stream` / `--limit` / `--force` so the 166-VOD history can be run in batches the
  owner controls.
- **New Studio foundation**: an owner-only Studio entry in the existing primary
  sidebar (no second sidebar), a single owner gate in the Studio layout that every
  later tool inherits, and a Studio-level owner stream list the other Creator Studio
  tools will reuse.
- **New Studio stream list** at `/studio`: every stream on the channel as a vertical
  list of rows, newest first, each row a small thumbnail, then the title, then action
  buttons, with a Timeline action linking to that stream's timeline.
- **New Studio Timeline page** at `/studio/timeline/[streamId]`: overlapping section
  lanes plus moment markers against VOD time, each showing label, tags, duration and
  scores, sortable and filterable by criterion, with click-to-seek on the VOD player.
- **Out of scope, deliberately** (follow-up change): the live incremental worker that
  opens/extends/closes rows during a stream, and the `/live` Timeline tab. Nothing
  here writes during a live stream.

## Capabilities

### New Capabilities

- `stream-timeline`: the sections/moments data model, its scoring contract, and the
  idempotent per-stream backfill labelling job that populates it from transcript and
  chat.

### Modified Capabilities

- `studio`: an owner-guarded Studio is re-established, entered from an `ownerOnly`
  item in the existing primary sidebar, with a stream list at `/studio` and a
  stream-keyed Timeline route beneath it. The spec's retired placeholder pages
  (`/studio` overview, Upload, Videos, Settings) are removed and are not recreated,
  since those routes no longer exist in the code — the control room was folded into
  `/live` and `components/studio-sidebar.tsx` was deleted, leaving the spec describing
  pages nothing implements.

## Impact

- **Database**: three new tables (`stream_sections`, `stream_moments`,
  `stream_chapters`) keyed to `streams.id`, with public-read / service-write RLS
  matching the existing `featured_messages` pattern, plus indexes on
  `(stream_id, start_s)`. Regenerated `supabase/types.ts`.
- **Worker/scripts**: one new script reusing `worker/lib/claude.ts` (`runClaude` +
  `extractJson`) and `supabase/admin-client.ts`. No new dependency and no Anthropic
  API key, per the `local-worker` spec.
- **App**: a new `app/(app)/studio/` route group holding the Studio layout (one owner
  gate, shared owner-stream list) plus `page.tsx` (the stream list) and
  `timeline/[streamId]/`. Two edits to `components/app-sidebar.tsx`: an `ownerOnly`
  Studio nav item, and prefix-aware active matching so nested routes highlight it. Two
  new shared components: `components/studio-stream-row.tsx` and
  `components/timeline-lanes.tsx`, the latter reused by the follow-up `/live` Timeline
  tab and the AZ-120 studio explorer. Reuses the existing `components/video-player/`
  for seeking. `/live` is not touched.
- **Cost**: about 6.8M tokens to label all 166 VODs through `claude -p`, one call per
  VOD, including the roughly 0.08M that chapters add. Batched runs keep that under the
  owner's control, and the first stream is labelled and reviewed before any batch runs.
- **AZ-189 decisions settled here**: navigation model (hybrid, stream-keyed routes),
  owner VOD library (Studio-level, shared), and Studio nav placement (one sidebar, no
  Studio-local sidebar).
