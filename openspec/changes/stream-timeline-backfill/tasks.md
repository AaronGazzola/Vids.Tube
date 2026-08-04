## 1. Schema

- [x] 1.1 Create the migration with `npx supabase migration new add_stream_timeline`.
  Add `stream_sections` (`id uuid pk default gen_random_uuid()`, `stream_id uuid not
  null references streams(id) on delete cascade`, `start_s double precision not null
  check (start_s >= 0)`, `end_s double precision null check (end_s is null or end_s >=
  start_s)`, `label text not null check (length(trim(label)) > 0)`, `summary text not
  null`, `tags text[] not null default '{}'`, `scores jsonb not null`, `prompt_version
  text not null`, `created_at timestamptz not null default now()`).
- [x] 1.2 In the same migration add `stream_moments` with the identical column set plus
  `kind text not null check (length(trim(kind)) > 0)`, and with `end_s` declared `not
  null` and `>= start_s`, so a point moment stores `end_s = start_s`.
- [x] 1.3 In the same migration add `stream_chapters` (`id`, `stream_id` with the same
  cascade, `start_s double precision not null check (start_s >= 0)`, `title text not
  null check (length(trim(title)) > 0)`, `status text not null default 'suggested'
  check (status in ('suggested','approved'))`, `prompt_version text not null`,
  `created_at`), plus `unique (stream_id, start_s)` so a spine cannot contain two
  chapters at the same instant.
- [x] 1.4 In the same migration add the shared score CHECK to `stream_sections` and
  `stream_moments`: each of `humour`, `interest`, `engagement` present in `scores`, of
  jsonb type `number`, and between 0 and 100 inclusive. Write it as one named
  constraint per table so a violation names the offending criterion set in its error.
  `stream_chapters` carries no scores.
- [x] 1.5 In the same migration add indexes `(stream_id, start_s)` on all three tables,
  and a GIN index on `tags` for `stream_sections` and `stream_moments`, since the UI
  filters by tag.
- [x] 1.6 In the same migration enable RLS on all three tables with a public `select`
  policy and no insert/update/delete policy, mirroring the `featured_messages` policies
  (the service role bypasses RLS, so the worker writes need no policy).
- [x] 1.7 Push with `npx supabase db push`, then regenerate types with
  `npx supabase gen types typescript --project-id cqblezzhywdjerslhgho > supabase/types.ts`
  and confirm all three Row types appear, with `scores: Json` and `tags: string[]` on
  the two scored tables.

## 2. Pure helpers with unit tests

- [x] 2.1 Create `lib/timeline.types.ts` exporting `TimelineScores` (`humour`,
  `interest`, `engagement`, plus an index signature for future criteria),
  `TimelineSection`, `TimelineMoment`, `TimelineChapter`, `TimelinePayload`, and
  `TimelineEntry` (the discriminated union the UI renders), all constructed from the
  generated `supabase/types` Row types.
- [x] 2.2 Create `lib/timeline.ts` exporting `SCORE_CRITERIA`, `PROMPT_VERSION`, and
  `validateTimelinePayload(raw: unknown, durationS: number)` returning
  `TimelinePayload | { error: string }`. It rejects: missing/extra top-level keys,
  non-finite or negative `start_s`, `end_s` before `start_s`, any timestamp past
  `durationS`, an empty `label`, `kind` or chapter title, a non-string tag, and any
  score that is missing, non-integer, or outside 0-100. The error string names the
  first offending entry and field.
- [x] 2.3 Extend `validateTimelinePayload` with the chapter-spine rules: chapters must
  be strictly increasing in `start_s`, the first must begin at 0, and none may exceed
  `durationS`. A violation rejects the whole payload, so a stream is never left with
  sections but a broken spine.
- [x] 2.4 Add `tests/unit/timeline-validate.test.ts` covering: a valid payload passes;
  an out-of-range score is rejected; a missing criterion is rejected; a timestamp past
  the duration is rejected; `end_s` before `start_s` is rejected; a moment with
  `end_s === start_s` passes; chapters out of order are rejected; a first chapter not
  at 0 is rejected.
- [x] 2.5 Add `snapSectionBoundaries(payload, boundaries, toleranceS)` to
  `lib/timeline.ts`, moving each section's `start_s` and `end_s` to the nearest
  transcript boundary within the tolerance and leaving boundaries with no candidate
  inside the tolerance unchanged. Moments and chapters are returned untouched.
- [x] 2.6 Add `tests/unit/timeline-snap.test.ts` covering: a boundary inside the
  tolerance snaps; a boundary outside it is left alone; the nearer of two candidates
  wins; moments are unchanged; chapters are unchanged.
- [x] 2.7 Add `mergeTimelinePayloads(payloads, overlapS)` to `lib/timeline.ts`,
  concatenating payloads in time order and dropping an entry from a later payload whose
  `start_s` falls inside the overlap window and which duplicates an earlier entry by
  label, then re-deriving a single strictly-increasing chapter spine. This is the seam a
  later fan-out pipeline reuses, so it takes N payloads rather than exactly two.
- [x] 2.8 Add `tests/unit/timeline-merge.test.ts` covering: two payloads with no overlap
  concatenate; a duplicated section across a seam is dropped once; a non-duplicate in
  the overlap window is kept; the merged chapter spine stays strictly increasing.
- [x] 2.9 Create `lib/timeline-lanes.ts` exporting `packSectionLanes(sections,
  durationS)` returning `{ section, lane }[]`, assigning each section the lowest lane
  index whose last section ends at or before this section's start (greedy interval
  packing over sections sorted by `start_s`, then by descending span so the longest
  containing section takes the top lane). A null `end_s` is treated as `durationS`.
- [x] 2.10 Add `tests/unit/timeline-lanes.test.ts` covering: two disjoint sections share
  lane 0; a section nested inside a longer one gets lane 1 with the longer one on lane
  0; three mutually overlapping sections occupy lanes 0/1/2; a null-`end_s` section
  packs as though it ran to `durationS`.
- [x] 2.11 Create `lib/timeline-activity.ts` exporting `chatActivitySeries(messages,
  bucketS)` returning per-bucket `{ atS, messages, uniqueAuthors }` from
  already-offset messages, and `formatActivitySeries(series)` rendering it as the
  compact lines the prompt embeds.
- [x] 2.12 Add `tests/unit/timeline-activity.test.ts` covering bucket boundaries
  (a message exactly on a bucket edge lands in the later bucket), unique-author
  counting within a bucket, and empty input returning an empty series.

## 3. Prompt and backfill script

- [x] 3.1 Create `worker/lib/timeline-prompt.ts` exporting `MOMENT_KINDS` (the
  documented starter set: `command`, `joke`, `chat_spike`, `featured_message`,
  `member_event`, `fail`, `reaction`) and `buildTimelinePrompt({ title, durationS,
  transcript, chatLines, activity })`. The prompt states the JSON contract from
  `validateTimelinePayload` including the third `chapters` array, states that sections
  may overlap and nest and must not be forced into a flat partition **while chapters
  must be exactly that flat non-overlapping spine**, defines each score criterion in
  absolute terms comparable across streams, instructs that engagement be read off the
  supplied activity series rather than the transcript's tone, and instructs the model to
  prefer an existing `MOMENT_KINDS` value over inventing a synonym. Follow the structure
  of `worker/lib/scoring-prompt.ts`.
- [x] 3.2 In `buildTimelinePrompt`, render the transcript as one timed line per source
  row, each carrying its own start time, and never merge rows into paragraphs. Boundary
  accuracy is bounded by this granularity.
- [x] 3.3 Create `scripts/backfill-stream-timeline.ts` with the service-role client and
  arg parsing of `scripts/import-youtube-vods.ts`: flags `--stream <id>`,
  `--limit <n>`, `--force`, `--dry-run`. Guard on startup that `stream_sections`,
  `stream_moments` and `stream_chapters` exist, aborting with a clear message naming
  the migration if not.
- [x] 3.4 Add `selectStreams()`: with `--stream`, that stream only; otherwise streams
  that have an associated ready `videos` row, ordered by `started_at` descending,
  excluding streams that already have any timeline row unless `--force`, limited by
  `--limit`.
- [x] 3.5 Add `loadStreamInputs(streamId)` returning `{ durationS, transcript, chat,
  activity, boundaries }`. Transcript precedence: page all `transcript_segments` for the
  stream ordered by `start_s`; if none, resolve the VOD via `streams.youtube_video_id`
  and page `youtube_transcripts`. Chat: `chat_messages` plus the VOD's
  `youtube_chat_archive`, every wall-clock timestamp converted with `messageVideoMs`
  from `lib/chat-replay.ts` using the stream's `live_at`/`started_at` base and its
  `stream_gaps` rows — do not reimplement the offset maths. `boundaries` is the sorted
  transcript boundary list used for snapping. Return null when no transcript exists.
- [x] 3.6 Add `labelStream(inputs)` as the swappable seam: build the activity series via
  `chatActivitySeries`, build the prompt, make exactly one `runClaude` call, parse with
  `extractJson`, validate with `validateTimelinePayload` against `durationS`, then apply
  `snapSectionBoundaries`. It takes normalized inputs and returns a validated payload or
  an error, so a later multi-step pipeline replaces this function alone. On failure
  return the error without writing anything.
- [x] 3.7 Add the oversize path: when the assembled prompt exceeds a `MAX_PROMPT_CHARS`
  constant, split into halves overlapping by a `SEAM_OVERLAP_S` constant, label each,
  and combine with `mergeTimelinePayloads`. Never truncate the transcript. Set the
  threshold high enough that it guards pathological inputs rather than firing on a
  normal multi-hour stream.
- [x] 3.8 Add `writeTimeline(streamId, payload)` performing, in one transaction via a
  single `rpc` or a delete-then-insert guarded by `--force`: delete the stream's
  existing sections, moments and chapters when forcing, then batch-insert the new rows
  with `PROMPT_VERSION`, chapters defaulting to `status = 'suggested'`. Under
  `--dry-run`, log the counts and write nothing.
- [x] 3.9 Add the run loop: per stream log one summary line (id, date, transcript
  source, section count, moment count, chapter count, elapsed), catch per-stream errors
  so one failure does not abort the batch, and finish with a `labelled / skipped /
  failed` tally. Add an `npm run backfill:timeline` script to `package.json` wrapping
  `tsx`.

## 4. Studio foundation

- [x] 4.1 Add `{ href: "/studio", label: "Studio", icon: <lucide icon>, ownerOnly:
  true }` to `NAV_ITEMS` in `components/app-sidebar.tsx`, so `useVisibleNavItems()`
  hides it from non-owners. Do not create a second sidebar.
- [x] 4.2 In `components/app-sidebar.tsx`, change the `NavRow` active test from
  `pathname === item.href` to a prefix-aware match (exact for `/`, otherwise
  `pathname === href || pathname.startsWith(href + "/")`), so `/studio/timeline/<id>`
  marks the Studio entry active. Confirm `/account` and `/live` still highlight
  correctly.
- [x] 4.3 Create `app/(app)/studio/layout.tsx`: a client layout calling
  `useRequireOwner()` from `app/layout.hooks` exactly once for the whole Studio area,
  rendering a skeleton while `isPending` and nothing while redirecting. This is the
  single owner gate every future Studio tool inherits; tools must not call the guard
  themselves.
- [x] 4.4 In `app/(app)/studio/layout.tsx`, render an in-page tool nav driven by a
  `STUDIO_TOOLS` array (one entry now: the stream list at `/studio`), so adding a tool
  later is a data change rather than layout surgery.
- [x] 4.5 Create `app/(app)/studio/layout.types.ts` exporting `OwnerStream` (id, title,
  started date, thumbnail url, VOD id, duration, `hasVod`, `hasTimeline`).
- [x] 4.6 Create `app/(app)/studio/layout.actions.ts` with `listOwnerStreamsAction()`
  returning every stream on the owner's channel newest first as `OwnerStream[]`,
  resolving each thumbnail from `videos.thumbnail_path` via `vodAssetUrl` and falling
  back to `streams.thumbnail_path`, and flagging `hasTimeline` from the presence of any
  `stream_sections` or `stream_moments` row. It validates `auth.getUser()` and owner
  status first and returns expected errors as `ActionResult` values per `CLAUDE.md`.
  This action is shared Studio-level data, not timeline-specific.
- [x] 4.7 Create `app/(app)/studio/layout.hooks.tsx` with `useOwnerStreams()` wrapping
  that action in React Query and unwrapping `ActionResult`.

## 5. Studio stream list

- [x] 5.1 Create `app/(app)/studio/page.tsx` rendering the page shell immediately and
  the streams from `useOwnerStreams()` as a **vertical list of rows**, newest first,
  with skeleton rows while pending. Do not use a grid.
- [x] 5.2 Create `components/studio-stream-row.tsx`: one row laying out a small
  thumbnail on the left, then the stream title (with its date and duration beneath),
  then an action-button group on the right, using flex so the three regions keep that
  order at every width. Render a placeholder block when the thumbnail url is null.
- [x] 5.3 In `components/studio-stream-row.tsx`, add the Timeline action button linking
  to `/studio/timeline/${stream.id}`, visibly marked when `hasTimeline` is false so an
  unlabelled stream is obvious before it is opened.
- [x] 5.4 Leave the action-button group extensible: it takes its buttons as an array so
  the later Shorts, Chapters, VOD-editor and Thumbnail tools add entries without
  restructuring the row.

## 6. Timeline page data layer

- [x] 6.1 Create `app/(app)/studio/timeline/[streamId]/page.types.ts` exporting
  `TimelineStreamDetail` (the stream's sections, moments, chapters, and its VOD's
  playback url, duration and dimensions), built from `lib/timeline.types.ts`.
- [x] 6.2 Create `app/(app)/studio/timeline/[streamId]/page.actions.ts` with
  `getStreamTimelineAction(streamId)` returning that detail. It validates
  `auth.getUser()` and owner status, returns a clear expected error when the stream
  does not exist or is not on the owner's channel, and throws only on infrastructure
  failure.
- [x] 6.3 Create `app/(app)/studio/timeline/[streamId]/page.hooks.tsx` with
  `useStreamTimeline(streamId)` keyed on the stream id.
- [x] 6.4 Create `app/(app)/studio/timeline/[streamId]/page.stores.ts` with a
  non-persisted Zustand `useTimelineViewStore` holding only view state: sort criterion,
  score threshold, active tag filter. The selected stream comes from the route, not the
  store.

## 7. Timeline UI

- [x] 7.1 Create `components/timeline-lanes.tsx`: a presentational component taking
  sections, moments, `durationS`, and an `onSelect(entry)` callback. It calls
  `packSectionLanes` for layout, renders each section as a positioned bar on its lane
  and each moment as a marker on a shared axis below, renders a null-`end_s` section
  running to `durationS` with a distinguishing treatment, and horizontally scrolls
  inside its own `overflow-x-auto` container so the page body never scrolls sideways.
- [x] 7.2 Add the entry detail rendering to `components/timeline-lanes.tsx`: each bar
  and marker shows its label and, on hover or focus, its summary, tags, duration and
  the three scores. Import `cn` from `@/lib/utils` for class composition.
- [x] 7.3 Add the chapter strip to `components/timeline-lanes.tsx`: a single
  non-overlapping row on the same time axis, each chapter showing its title and running
  to the next chapter's start, selectable like a section and omitted entirely when the
  stream has no chapters.
- [x] 7.4 Create `app/(app)/studio/timeline/[streamId]/page.tsx` rendering the shell
  immediately, a back control to `/studio`, and the stream's `VideoPlayer` plus
  `TimelineLanes` from `useStreamTimeline`, with inline skeletons only over the
  data-dependent regions.
- [x] 7.5 In that page, render the not-found state when the action reports an unknown
  or non-owned stream, and an explicit "not labelled yet" state when the stream exists
  but has no timeline rows.
- [x] 7.6 In that page, add the sort and filter controls bound to the store (sort by
  criterion, minimum score threshold, tag filter) and apply them to both the lanes and a
  ranked list view beside them.
- [x] 7.7 Wire click-to-seek: `onSelect` sets a seek request that clamps the entry's
  `start_s` to the VOD's `duration_s` and passes it to the player, and works for
  sections, moments and chapters alike.

## 8. Player seek support

- [x] 8.1 Add an optional `seekRequest?: { seconds: number; id: number }` prop to
  `VideoPlayerProps` in `components/video-player/VideoPlayer.tsx`, and an effect that
  seeks the media element when `id` changes. Existing callers pass nothing and are
  unaffected; the `id` makes repeated clicks on the same entry re-seek.
- [x] 8.2 Export the new prop type from `components/video-player/index.ts` and confirm
  `app/watch/[videoId]/page.tsx` still type-checks without change.

## 9. Verification

- [x] 9.1 Run `npx vitest run tests/unit/timeline-validate.test.ts
  tests/unit/timeline-snap.test.ts tests/unit/timeline-merge.test.ts
  tests/unit/timeline-lanes.test.ts tests/unit/timeline-activity.test.ts` and confirm
  all pass.
- [x] 9.2 Run `npx tsc --noEmit` and confirm no type errors.
- [x] 9.3 Run `doppler run -- npm run build` and confirm a clean production build.
- [x] 9.4 Run `doppler run -- npm run backfill:timeline -- --limit 1 --dry-run` and
  confirm it selects the newest unlabelled stream, assembles a prompt, and writes
  nothing.
- [x] 9.5 Add `tests/e2e/studio-timeline.spec.ts` asserting: a non-owner is redirected
  away from `/studio`; the owner sees the Studio sidebar entry and a vertical list of
  stream rows; the Timeline action navigates to `/studio/timeline/<id>`; and for a
  labelled stream the lanes render overlapping sections on distinct lanes with score
  values visible.
