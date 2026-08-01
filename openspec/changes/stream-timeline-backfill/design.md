## Context

The pieces this change joins together already exist. `transcript_segments` holds
live whisper output keyed to a stream with `start_s`/`end_s`; `youtube_transcripts`
holds caption text keyed to a VOD with the same shape; `chat_messages` holds both
origins' live chat; `youtube_chat_archive` holds the back-catalogue's YouTube chat
keyed to a VOD. `lib/chat-replay.ts` already converts a message's wall-clock time
into VOD time, removing reconnect gaps from `stream_gaps`, and is unit tested.
`worker/lib/claude.ts` already wraps `claude -p` with `runClaude` + `extractJson`.

What is missing is any record of *what happened when*. Measured corpus: 166
YouTube VODs, all with captions (416,938 rows, about 3.6M tokens); 5 native streams
with denser whisper transcripts; 9,823 chat messages across both chat tables, which
is negligible next to the transcript.

The `local-worker` spec forbids an Anthropic SDK or API key in the deployed app, and
the owner has chosen `claude -p` for the whole back catalogue, so all labelling runs
through the existing worker plumbing and is billed to the Claude subscription.

## Goals / Non-Goals

**Goals:**

- A queryable, VOD-timestamped index of stream content that overlapping shorts
  curation (AZ-120/121/122) and non-overlapping chapters (AZ-192) can both consume.
- Backfill the existing history in operator-controlled batches, cheaply and
  restartably.
- A review surface good enough to judge label and score quality against the actual
  video, so the prompt can be iterated before the whole history is spent on it.
- Build the lane renderer once, so the follow-up `/live` Timeline tab and the AZ-120
  studio explorer reuse it rather than reimplementing it.

**Non-Goals:**

- Writing timeline rows during a live stream. The incremental open/extend/close/
  re-score worker and the `/live` Timeline tab are the follow-up change; nothing here
  runs mid-stream.
- The chapters *feature*. Chapter rows are produced here as a by-product of the same
  pass, but the per-channel auto-apply setting, the approve/edit UI and the public
  seekbar rendering stay in AZ-192.
- Public exposure of the timeline. Read access is public at the row level (matching
  `featured_messages`), but the only surface built here is owner-only.
- Importing the 35 remaining YouTube VODs. That is an operational run of the existing
  `scripts/import-youtube-vods.ts`, tracked separately; this change works on whatever
  streams have transcripts.

## Decisions

### Two tables, not one polymorphic table

`stream_sections` and `stream_moments` are separate tables sharing a column shape.
They are queried differently (spans that overlap vs points on an axis), moments carry
a `kind` that sections do not, and the downstream consumers want them separately
(a moment becomes a clip candidate, a section becomes a throughline arc).

*Alternative considered*: one `stream_timeline_entries` table with an `entry_type`
discriminator. Rejected because every consumer query would filter on the
discriminator anyway, and the shared columns are not enough to justify the looser
model — a `kind` that is meaningful for half the rows is the usual sign of two
tables.

### Column naming and where precision actually comes from

AZ-206 writes `start_ts`/`end_ts`. This change uses `start_s`/`end_s` to match
`transcript_segments` and `youtube_transcripts`, so timeline rows join to transcript
rows without a units conversion at every call site.

The naming carries no precision implication. Precision comes from the column type,
which is `double precision` seconds: roughly 15 significant digits, so on a 4-hour
stream it resolves far below a microsecond. It is already finer than anything upstream
can supply.

The real precision ceiling is the input:

- `transcript_segments` is written at whisper's **segment** granularity, typically a
  few seconds per row.
- `youtube_transcripts` is at caption-cue granularity, roughly 1-5 seconds.
- The model can only cite boundaries present in what it is shown.

Two consequences for the labelling pass, both about giving the model the best
timestamps available rather than a finer-looking column:

- **Feed the transcript as per-segment lines carrying their own timestamps**, never as
  merged paragraphs. Merging destroys exactly the boundary information the labels need.
- **Snap section boundaries to the nearest transcript segment boundary** within a
  tolerance. A model-emitted `1234.5` when the utterance actually began at `1233.2` is
  false precision, and snapping makes a section start where someone started speaking.
  Moments are deliberately **not** snapped: a laugh, a fail or a chat spike can land
  mid-segment, and snapping would move it off the thing it marks.

### One `claude -p` call per stream, behind a seam

"One call" means one invocation sees the whole stream and returns the whole label set.
It does not mean one processing step forever.

Context is not the constraint. A 2-hour stream is about 22K tokens of transcript
against a 1M-token window; a 6-hour stream is about 66K. The whole-stream call is
affordable by a wide margin, which is why the oversize threshold is a guard against
pathological inputs rather than a routine path.

Two reasons the whole-stream view is the right default:

- **Product**: overlapping sections are only recognisable with a whole-stream view. A
  windowed pass sees the 6-minute argument but cannot know it sits inside a 40-minute
  debugging session, which is the structure the ticket asks for.
- **Cost**: each `claude -p` invocation carries the Claude Code system prompt (roughly
  12K tokens) that a direct API call would not. At one call per 10-minute window the
  whole history costs about 28M tokens, dominated by that overhead; at one call per
  stream it is about 6.8M. A 4x lever that also produces better output.

**Not painting into a corner.** The labelling step is a seam, not an inlined prompt.
The script is four separable pieces:

- `loadStreamInputs(streamId)` — transcript, chat and activity series, normalized.
- `labelStream(inputs)` — inputs to a validated payload. **This is the swappable
  part**; today it makes one call.
- `mergeTimelinePayloads(payloads)` — combine partial results and dedupe across seams.
- `writeTimeline(streamId, payload)` — persistence.

A later multi-step pipeline (a coarse whole-stream planning pass, then per-span detail
agents in parallel, then a merge) replaces `labelStream` alone. `mergeTimelinePayloads`
is promoted to a first-class, unit-tested helper rather than being inlined in the
oversize path precisely because a fan-out design needs it most. `prompt_version` on
every row lets a new pipeline's output coexist with and be compared against the current
generation instead of silently overwriting it.

### Chapters are derived in the same pass

The same call returns a third array. Chapters are one flat, non-overlapping, ordered
spine over the VOD (`start_s` plus a title, each chapter running to the next), stored in
`stream_chapters` with `status` defaulting to `suggested`.

The reason is cost, not convenience. The expensive part of AZ-192 is reading 166 VODs'
transcripts, which this change already does. A separate chapters pass later is a second
sweep of roughly the same 6.8M tokens; asking for the array here costs a few hundred
output tokens per VOD, about 0.08M in total.

What stays in AZ-192: the per-channel `auto-apply` vs `suggest-and-confirm` setting, the
approve and edit UI, the public seekbar segments and chapter list on
`watch/[videoId]`, and the VOD-editor cut-sync concern. Those are a public-facing
feature with a different audience; only the rows are produced here, and `status` is what
lets AZ-192 decide what becomes public.

*Alternative considered*: deriving chapters algorithmically by flattening the stored
sections, with no model output at all. Cheaper still, but a greedy flattening of
overlapping spans produces a spine that reads like a machine chose it, and the saving is
0.08M tokens.

### Scores as jsonb with a database-level check

`scores jsonb not null`, with a CHECK constraint asserting that `humour`, `interest`
and `engagement` are each present and are integers within 0-100. jsonb satisfies the
ticket's "room for more criteria without a migration per criterion"; the CHECK keeps
a bad model response from silently landing as a row that later ranks wrongly.
Validation lives in the database rather than only in the script so that any future
writer — the live worker, a manual correction, a re-score pass — inherits it.

*Alternative considered*: three typed integer columns. Cheaper to index and query,
but every added criterion is a migration, which the ticket explicitly rules out.

Scores are absolute, not stream-relative, because cross-stream shorts compilations
(AZ-189's cross-stream requirement) need to rank candidates from different streams
against each other. The prompt therefore has to describe what each score *means* in
absolute terms rather than asking for a ranking.

### One `claude -p` call per stream

The pass sends the whole stream in a single call. Two reasons, one product and one
cost:

- **Product**: overlapping sections are only recognisable with a whole-stream view. A
  windowed pass sees the 6-minute argument but cannot know it sits inside a 40-minute
  debugging session, which is exactly the structure the ticket asks for.
- **Cost**: each `claude -p` invocation carries the Claude Code system prompt (roughly
  12K tokens) that a direct API call would not. At one call per 10-minute window the
  whole history costs about 28M tokens, dominated by that per-invocation overhead. At
  one call per stream it is about 6.8M. The design choice is a 4x cost lever, and it
  favours the option that also produces better output.

A 2-hour stream is roughly 22K tokens of transcript plus a few hundred tokens of
chat, comfortably inside context. Streams materially longer than that are handled by
the halving fallback below rather than by windowing every stream.

### Shared time base via `lib/chat-replay.ts`

Timeline timestamps must land on the same axis as the VOD player and chat replay, or
click-to-seek lands in the wrong place. The backfill converts each chat message's
wall-clock time with the existing `messageVideoMs` from `lib/chat-replay.ts`
(anchored on `streams.live_at`, falling back to `started_at`, with `stream_gaps`
removed) rather than computing offsets itself. Transcript rows are already
stream-relative and need no conversion. Imported YouTube VODs have no reconnect gaps,
so the same helper degenerates to a plain subtraction for them.

This is the one piece of logic most likely to be duplicated by mistake; it must not
be.

### Prompt returns a single JSON object, validated before any write

The pass asks for `{ "sections": [...], "moments": [...] }` and parses with the
existing `extractJson`. The script validates the whole payload — timestamps within
the stream's duration, `end_s` at or after `start_s`, required score criteria in
range, tags non-empty strings — and writes nothing for that stream if validation
fails. This keeps the failure mode "stream reported failed, no rows" rather than
"stream half-labelled", which matters for a resumable job whose skip condition is
"does this stream have rows".

### Idempotency by presence, force by replace-in-transaction

The job's default skip condition is "this stream already has timeline rows", which
needs no extra state column. `--force` deletes the stream's existing sections and
moments and inserts the new pass in one transaction, so a forced re-run cannot leave
duplicates or a half-replaced stream.

*Alternative considered*: a `timeline_labelled_at` column on `streams`. Rejected as
redundant state that can disagree with the rows it describes.

### Deterministic ordering so batches are predictable

Stream selection is ordered newest-first, so `--limit 1` labels the most recent
unlabelled stream and the review-then-widen sequence the owner asked for falls out of
the default behaviour.

### Moment kinds are free text with a documented starter set

`stream_moments.kind` is `text not null` (non-empty), not an enum. The ticket's list —
chat commands, a joke that landed, a chat-rate spike, a highlighted message, a
raid/member event, a mistake or fail, a strong reaction in the transcript — is
explicitly open-ended, and an enum would need a migration per new kind, the same trap
the `scores` column avoids. The prompt names that starter set and instructs the model
to prefer an existing kind over inventing a synonym; the set is documented next to the
prompt so it stays the single source of truth.

### Engagement is measured, not guessed

The ticket requires that engagement be informed by observable chat signal rather than
the model's impression. The script therefore computes a per-minute activity series
from the stream's own data before the call — message count, unique chatters, and
command/TTS activity from `command_events` and `tts_requests` — and includes it in the
prompt as a compact series alongside the transcript. The model scores engagement
against that series rather than inferring it from how lively the transcript reads, and
a chat-rate spike becomes a moment the model can point at rather than one it has to
notice.

### Lane layout computed in a pure function

Assigning overlapping sections to lanes is a greedy interval-packing problem. It goes
in a pure, unit-tested helper (`lib/timeline-lanes.ts`) taking sections and returning
lane indices, so the renderer stays presentational and the follow-up live tab reuses
the same packing without a live stream to test against.

### The Studio shell has to be re-established, not extended

There is no `/studio` route in the codebase. The archived `studio` spec describes
`/studio` plus Upload, Go Live, Broadcasts, Videos and Settings pages, but those were
retired when the control room was folded into `/live` (see the archived
`unify-studio-control-hub` change and the `streamer-control-room` spec);
`components/studio-sidebar.tsx` no longer exists. So this change re-establishes
`app/(app)/studio/`, and the `studio` delta spec removes the retired placeholder
requirements rather than leaving the spec asserting pages that do not exist. Those
pages stay removed: nothing here recreates Upload, Videos management or Channel
settings.

`/live` is untouched by this change.

### One sidebar, one owner gate

The Studio does **not** get its own sidebar. That was the shape of the deleted
`components/studio-sidebar.tsx`, and the app has since settled on one primary sidebar
in `components/app-sidebar.tsx` whose `NAV_ITEMS` entries carry an `ownerOnly` flag
filtered through `useIsOwner()`. The Studio is one more `ownerOnly` entry there;
navigation between Studio tools is in-page, driven by a `STUDIO_TOOLS` array.

Two consequences worth stating because every later tool depends on them:

- `NavRow`'s active test is currently `pathname === item.href`, which cannot highlight
  a nested route. It becomes prefix-aware so `/studio/timeline/<id>` marks the Studio
  entry active.
- `useRequireOwner()` is called **once**, in `app/(app)/studio/layout.tsx`, not per
  page as `/live` does it. Four more tools are coming (AZ-120 shorts, AZ-190 VOD
  editor, AZ-191 thumbnails, AZ-192 chapters); each calling the guard itself is four
  places to fix when AZ-31 makes the studio per-channel rather than platform-owner.
  Note `useIsOwner()` compares against the single platform-owner channel today, so the
  Studio is deliberately single-streamer until AZ-31.

### Navigation model: hybrid, stream-keyed routes

AZ-189 decision 1 (per-VOD hub vs per-tool pages vs hybrid) is settled here as the
hybrid, on the owner's instruction:

- `/studio` is the stream list, the per-stream entry point.
- `/studio/timeline/[streamId]` is a per-tool route keyed by a stream.
- Later single-stream tools follow the same shape (`/studio/chapters/[streamId]`, and
  so on).
- Shorts remain the exception, since a shorts project may span several streams
  (AZ-189's cross-stream requirement); they get a project-keyed route reachable both
  from a stream row and from a top-level list.

Putting the stream id in the route rather than in component state is what makes this
foundation cheap to extend: review links are shareable, the back-to-list control is a
plain link, and the view store shrinks to sort/threshold/tag.

### The owner stream list is Studio-level, not timeline-level

`listOwnerStreamsAction` and `useOwnerStreams` live in
`app/(app)/studio/layout.actions.ts` / `layout.hooks.tsx`, not under the timeline
route. Per the file-placement rule in `CLAUDE.md`, shared functionality goes higher in
the tree, and this list is exactly what AZ-190, AZ-191, AZ-192 and AZ-120 each need as
their entry surface. It is also the concrete answer to AZ-189 decision 2 (owner VOD
library), which the Studio has never had.

The row itself (`components/studio-stream-row.tsx`) takes its action buttons as an
array, so a later tool adds an entry rather than restructuring the row.

## Risks / Trade-offs

- **The prompt produces plausible but wrong labels or miscalibrated scores** → this is
  the reason the change stops at one stream plus a review UI. The job's `--limit` and
  `--force` exist so the prompt can be re-run over a handful of streams as it is
  tuned, and the whole history is only spent once the output has been judged on real
  video.
- **Absolute scores drift as the prompt changes** → rows labelled by different prompt
  versions are not strictly comparable. Mitigated by recording the prompt version on
  each row, so a later re-score pass can find and replace stale generations.
- **A pathologically long stream overruns the context window** → unlikely, since a
  6-hour stream is about 66K tokens against a 1M window, but if the assembled prompt
  exceeds the threshold the pass halves it into two overlapping calls (overlapping so a
  section spanning the seam is still seen whole) and merges via
  `mergeTimelinePayloads`, rather than silently truncating the transcript. Truncation
  is never acceptable here; it would produce a timeline that looks complete but stops
  early.
- **6.8M tokens of `claude -p` against the Claude subscription** → the owner has
  accepted this. Mitigated by batching (`--limit`), newest-first ordering, and the
  per-stream summary log, so a run can be stopped at any point without losing work.
  Switching to a direct API call would be cheaper and predictable, but conflicts with
  the `local-worker` spec's no-API-key rule and was declined.
- **Click-to-seek lands off-target on imported VODs** → the imported synthetic
  streams' `live_at` came from YouTube's `publishedAt`, which may not be frame-exact
  against the downloaded MP4. Mitigated by seeking through the same helper chat replay
  uses, so any anchor error is consistent with chat replay rather than a second,
  differently-wrong offset. Reviewing the first backfilled stream against the player
  is what will reveal whether the anchor is good enough.
- **Two tables mean two queries for a combined view** → accepted; the UI fetches both
  in one action and merges for rendering.

## Migration Plan

1. Migration creates both tables with RLS and indexes; `npx supabase db push`, then
   regenerate `supabase/types.ts`.
2. Run the backfill for a single recent stream (`--stream <id>`), review it in
   `/studio/timeline` against the VOD, and iterate on the prompt with `--force`.
3. Widen to a small batch (`--limit 5`), review, then run the history in batches.
4. Rollback is dropping the two tables; nothing else depends on them yet, and no
   existing behaviour changes.

## Open Questions

None outstanding. The two that arose while writing this design are settled above:
moment `kind` is free text with a documented starter set (see "Moment kinds"), and the
chat-activity series is computed arithmetically and passed to the model as a hint (see
"Engagement is measured, not guessed").
