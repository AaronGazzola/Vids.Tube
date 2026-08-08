## 1. Schema

- [x] 1.1 Create a migration (`npx supabase migration new timeline_threads`) that drops
  `public.stream_sections` (and its indexes and policy) outright — one broadcast is
  labelled and its rows are discarded, not migrated.
- [x] 1.2 In the same migration create `public.stream_threads`: `id`, `stream_id`
  (fk to `streams`, on delete cascade), `title` (non-empty), `summary`, `tags text[]`
  default `{}`, `scores jsonb` with the same 0-100 humour/interest/engagement CHECK the
  dropped table carried, `prompt_version`, `created_at`.
- [x] 1.3 In the same migration create `public.stream_thread_spans`: `id`, `thread_id`
  (fk to `stream_threads`, on delete cascade), `stream_id` (fk to `streams`, on delete
  cascade, carried so the map reads with one query per stream), `start_s`, `end_s`
  (both `double precision`, `end_s >= start_s`), `label` (non-empty), `ordinal int`,
  `scores jsonb` with the same CHECK, `created_at`; unique on `(thread_id, ordinal)`.
- [x] 1.4 In the same migration alter `public.stream_moments`: add `peak_s double
  precision not null`, add `thread_id uuid` referencing `stream_threads` on delete set
  null, and add a CHECK that `start_s <= peak_s <= end_s` and `end_s > start_s`.
  Existing moment rows are deleted first, since half of them are zero-length and cannot
  satisfy the new constraint.
- [x] 1.5 Add indexes: `(stream_id)` on threads, `(stream_id, start_s)` and
  `(thread_id, ordinal)` on spans, `(stream_id, thread_id)` on moments, and a gin index
  on `stream_threads.tags`. Drop the gin index that belonged to `stream_sections`.
- [x] 1.6 Enable row level security on both new tables with a public-select policy,
  matching the tables they replace.
- [x] 1.7 Push with `npx supabase db push` and regenerate types with
  `npx supabase gen types typescript --project-id <ref> > supabase/types.ts`.

## 2. Payload model, validation and fused time

- [x] 2.1 Rewrite `lib/timeline.types.ts`: replace `TimelineSection` with
  `TimelineThread` (title, summary, tags, scores, `spans: TimelineSpan[]`) and
  `TimelineSpan` (start_s, end_s, label, scores); extend `TimelineMoment` with `peak_s`
  and `thread: string | null`; change `TimelinePayload` to `{ threads, moments,
  chapters }`. Export row types for the two new tables.
- [x] 2.2 Rewrite `validateTimelinePayload` in `lib/timeline.ts` for the new shape:
  reject a thread with no spans, a span whose end precedes its start, a span or moment
  timestamp past the stream duration, a moment whose `end_s` equals its `start_s`, a
  moment whose `peak_s` falls outside its window, and any score that is not an integer
  0-100. Keep the existing chapter rules unchanged.
- [x] 2.3 In the same function, resolve each moment's `thread` title against the
  payload's threads case-insensitively; set it to null when it does not match rather
  than failing the payload.
- [x] 2.4 Rename `snapSectionBoundaries` to `snapSpanBoundaries` and apply it to every
  span of every thread, preserving the existing tolerance behaviour. Widen its guard
  from "would invert the span" to "would leave it with no duration": both ends of a
  short span can snap to the same boundary, which would erase it from the map and from
  fused playback.
- [x] 2.5 Rewrite `mergeTimelinePayloads` for threads: merge two half-stream payloads by
  thread title (case-insensitive), concatenating the spans of threads that appear in
  both and de-duplicating spans whose starts fall within the seam overlap; keep the
  existing moment and chapter merge behaviour, now also de-duplicating on `peak_s`.
- [x] 2.6 Bump `PROMPT_VERSION` to `timeline-2`.
- [x] 2.7 Create `lib/fused-timeline.ts` exporting `fusedDuration(spans)`,
  `fusedToReal(spans, fusedS)` returning `{ realS, index } | null`, and
  `realToFused(spans, realS)` returning `number | null`. A seam resolves forward to the
  next span's start; a real time inside a gap returns null; zero-length spans are
  skipped; an empty set has zero duration and every lookup returns null.

## 3. Labelling prompt

- [x] 3.1 Rewrite the rubric in `worker/lib/timeline-prompt.ts` to ask for THREADS with
  nested spans instead of SECTIONS, stating that a subject occurring in several places
  is one thread with several spans and naming the failure mode directly — a subject
  discussed early, returned to mid-stream and closed at the end is one thread with three
  spans, not three threads.
- [x] 3.2 Change the MOMENTS part of the rubric to require a window that stands alone as
  a clip, with the setup before and the reaction after, plus a `peak_s` for where the
  event happens; state that a zero-length moment is invalid. Keep the existing
  `MOMENT_KINDS` guidance.
- [x] 3.3 Add to the rubric that a moment may name the thread it belongs to by title, or
  null when it belongs to no particular subject.
- [x] 3.4 State in the rubric that thread tags name the *subject* and are the axis for
  finding the same subject in other streams, so they should be the words that would
  still make sense on a different broadcast — not a quality (which the scores measure)
  and not an event type (which a moment's kind carries).
- [x] 3.5 Update the output shape in the prompt to the new JSON, keeping the "return
  ONLY a JSON object" instruction and the absolute-scoring and timestamp rules verbatim.
- [x] 3.6 Keep the score rubric text unchanged, including that engagement is read from
  the supplied activity series rather than from how lively the transcript reads.

## 4. Backfill

- [x] 4.1 Update `labelledStreamIds()` in `scripts/backfill-stream-timeline.ts` to
  consider a stream labelled only when its rows carry the current `PROMPT_VERSION`, so a
  prompt change makes the catalogue a candidate again without `--force`.
- [x] 4.2 Rewrite `writeTimeline` to clear and insert the new tables: delete threads,
  moments and chapters for the stream, insert threads, insert each thread's spans with
  their `ordinal`, then insert moments with their resolved `thread_id`. Keep the whole
  write ordered so a failure part-way leaves no thread without its spans.
- [x] 4.3 **Gate.** Relabel the 28-Jul broadcast
  (`dc3386b6-dde2-48e7-bd8f-55f957218c57`) and report how many threads hold more than
  one span. If every thread holds exactly one, the prompt has changed nothing: stop,
  report it, and do not build the UI on top of it.
- [x] 4.4 Update the run summary line to report threads, spans, moments and chapters.

## 5. Fused playback in the shared player

- [x] 5.1 Add an optional `spans` prop to `VideoPlayer` (an ordered list of
  `{ startS, endS }`). With none, behaviour is exactly as now.
- [x] 5.2 When spans are given, watch `timeupdate` and seek to the next span's start as
  the playhead passes the current span's end; pause at the end of the last span. Seek
  into the first span on load and whenever the span set changes.
- [x] 5.3 Derive the transport's position and duration from the fused mapping when spans
  are given, so the seek bar measures the fused piece; route seeks back through
  `fusedToReal`. The elapsed/duration text follows the same clock.
- [x] 5.4 Keep arrow-key seeking working within the fused piece: a seek that would land
  in a gap resolves to the nearest point inside a span.

## 6. The map

- [x] 6.1 Replace `lib/timeline-lanes.ts`: a lane belongs to a thread and holds all of
  its spans, so `packThreadLanes(threads)` returns one lane per thread ordered by the
  thread's score on the selected criterion, descending.
- [x] 6.2 Add `uncoveredStretches(spans, durationS)` to the same module, returning the
  stretches of the stream that no span occupies, with unit tests over the touching,
  overlapping, empty and full-coverage cases.
- [x] 6.3 Rewrite `components/timeline-lanes.tsx` to render four bands on one axis:
  chapters as a quiet ruler, one row per thread carrying its spans, moments drawn at the
  width of their windows with the peak marked inside, and a coverage band showing
  unoccupied stretches.
- [x] 6.4 Draw each entry's label and its scores on the entry itself rather than relying
  on the `title` attribute; keep a tooltip for the summary only.
- [x] 6.5 Add time markings every five minutes across the axis, replacing the two
  end-labels.
- [x] 6.6 Keep the horizontal scroll container so a wide timeline scrolls inside itself
  and the page body never scrolls sideways.

## 7. The studio page

- [x] 7.1 Update `app/(app)/studio/timeline/[streamId]/page.actions.ts` to read threads
  with their spans, moments with their windows and peaks, and chapters, in place of
  sections.
- [x] 7.2 Update the page types and the query hook for the new shape.
- [x] 7.3 Remove the per-tag button row and the `tag` field from the view store; keep
  the criterion selector and the minimum-score filter.
- [x] 7.4 State on the page when the score filter is hiding entries, and how many, so a
  filtered map cannot be misread as an empty one.
- [x] 7.5 Selecting a thread switches the player onto that thread's fused span set and
  shows which thread is playing; selecting a moment or chapter seeks the whole VOD.
- [x] 7.6 Add a control to leave the fused view that returns the player to the whole VOD
  at the real time the fused playhead was on.
- [x] 7.7 Rewrite the ranked list beneath the map for threads and moments, showing each
  thread's spans and their individual times, and offer it in time order as well as score
  order.

## 8. Verification

- [x] 8.1 Unit tests for `lib/fused-timeline.ts`: fused-to-real inside each span, at a
  seam resolving forward, at zero and at the fused duration; real-to-fused inside a span
  and inside a gap; the empty set; a set with a zero-length span; a single span.
- [x] 8.2 Unit tests for the rewritten validation: a thread with no spans, a span past
  the duration, a zero-length moment, a peak outside its window, a non-integer score, an
  unresolvable thread reference dropping to null, and a valid payload passing intact.
- [x] 8.3 Unit tests for `packThreadLanes` and `uncoveredStretches`.
- [x] 8.4 Unit tests for the rewritten merge: two half-stream payloads whose threads
  share a title merge into one thread holding both halves' spans, and spans inside the
  seam overlap are not duplicated.
- [x] 8.5 A render test asserting the player's transport measures the fused duration
  when spans are given and the source duration when they are not.
- [x] 8.6 Update `tests/e2e/studio-timeline.spec.ts` for the new map: a labelled stream
  renders thread lanes with a recurring thread on one lane, moments render with non-zero
  width, and no per-tag control row is present.
- [x] 8.7 Run `npx tsc --noEmit`, `npm run lint`, `npx vitest run` and
  `doppler run -- npm run build:local`; all clean.
- [x] 8.8 Relabel five more streams spread across the catalogue, then report the subject
  vocabulary the model reached for across all six — how many distinct subjects, which
  recur across streams, and which look like one-offs — as the evidence for choosing the
  controlled list.

  **Outcome: no controlled list.** Six broadcasts produced 116 distinct subjects, 14 of
  them recurring. The 14 are the channel's constants — vibe-coding, community, nextjs,
  llm — and a constant discriminates nothing, so a fixed list would have locked in
  exactly the words that carry no information. Roughly half the one-offs were generic
  technical vocabulary too, so the fault is not the tail: it is that topics are being
  named at all. Tags are redefined in section 9 instead.

## 9. Tags mark what departs from the background

- [ ] 9.1 Add a `background` field to the labelling payload: before anything else the
  pass states this stream's steady state — the activity, subject matter and setting that
  persist through most of it. Validate it as a non-empty string.
- [ ] 9.2 Rewrite the TAGS part of the rubric around that background. A tag names
  something that happened and is notable *against* the steady state, never a topic the
  stream is about. State the test explicitly: a tag that could sit on most of this
  channel's broadcasts is not a tag, however central the thing is.
- [ ] 9.3 Illustrate what qualifies without fixing a taxonomy — a joke that landed, an
  awkward or embarrassing turn, a problem solved or a bug found, something achieved or
  reached for the first time, a surprise, a mistake, an argument, a change of mind, a
  digression into something unrelated — and say plainly that the list is illustrative
  rather than a menu, so the instruction does not overfit to one kind of content.
- [ ] 9.4 Require a tag to be written as the specific thing rather than its category,
  with a worked contrast in the prompt, and forbid naming the stack, the tools or the
  genre.
- [ ] 9.5 Add `timeline_background text` to `public.streams` in a migration; push and
  regenerate types.
- [ ] 9.6 Store the background on the stream in the backfill writer, and clear it when a
  stream is relabelled.
- [ ] 9.7 Show the background on the Studio timeline page above the map, so the ground
  the tags are figured against is visible while reviewing them.
- [ ] 9.8 Bump `PROMPT_VERSION` to `timeline-3`.
- [ ] 9.9 Unit tests: a payload with no background is rejected; a payload with one is
  accepted and carries it through.
- [ ] 9.10 Relabel one recent broadcast, then report its background and its tags against
  the six already labelled — whether the tags now name happenings rather than topics, and
  whether any of the channel's constants survived.
