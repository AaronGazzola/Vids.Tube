## Context

The deployed Vids.Tube app runs on Vercel and is intentionally key-free. Two
in-flight workstreams — the chat-scoring overlay (AZ-111, shipped) and the shorts
creator being merged from `../AI VOD generator` (AZ-119) — need compute the app
cannot host: `whisper.cpp` transcription, `ffmpeg`, and the Claude **subscription**
via `claude -p`. Both also need a stream transcript. Today there is no
transcription anywhere in the repo, and the `AI VOD generator` does its own
throwaway whisper pass on a downloaded YouTube VOD.

This change stands up the single out-of-process worker that owns that compute and
the shared transcript it produces. It builds on the AZ-111 control-plane/data-plane
pattern (the studio toggles `chat_scoring_state.enabled`; an external service does
the work) and the existing `streams`/`videos` spine (`videos.source_stream_id`
already links a VOD back to its live stream).

## Goals / Non-Goals

**Goals:**
- One local worker process in the repo (`worker/`) that is the data plane: holds the
  secret key, runs the binaries + `claude -p`, polls Supabase for work. Extensible to
  future jobs (chat scoring, shorts) without a rewrite.
- A shared `transcript_segments` store, written once per stream, readable by every
  later consumer (chat scoring, shorts, VOD subtitles).
- A live transcription job that turns the public HLS into timestamped segments in
  near-real-time.

**Non-Goals:**
- The chat-scoring job (next change) — this change only produces the transcript it
  will read.
- Shorts data model/editor/render (AZ-120/121), VOD subtitle UI (AZ-116), and
  native-signal analysis (AZ-122).
- Any Anthropic SDK / API key / LLM code in the deployed app.
- Post-hoc transcription of a VOD that was never transcribed live (a YouTube-sourced
  fallback belongs to the shorts pipeline, AZ-121).
- Word-level timestamps, speaker diarization, multi-channel.

## Decisions

- **The worker is a top-level `worker/` directory, not a monorepo workspace.**
  (AZ-119 decision 4.) The app is wall-to-wall `@/` imports; converting to
  `apps/web` rewrites all of them for no user benefit. `worker/` runs via `tsx`
  outside the Next build, imports shared modules from the app
  (`supabase/admin-client.ts`, `supabase/types.ts`, `lib/r2.ts`), and keeps its
  ported binary wrappers (`whisper`, `ffmpeg`, `claude`/`runClaude`, `exec`) local
  under `worker/lib/`. *Alternative — workspaces:* cleaner long-term isolation but a
  broad, regression-prone import rewrite now; defer until the worker grows its own
  heavy dep tree.

- **One process, a thin job dispatcher, jobs as separate modules.** This change
  ships only the transcription job, but the dispatcher (`worker/jobs/`) and a small
  loop are built so chat scoring (next) and shorts (later) drop in as sibling
  modules. *Alternative — separate processes per job:* reintroduces "who transcribes,
  how to avoid double-runs" coordination; one process owning the transcript
  lifecycle is the simplest way to guarantee a single whisper pass.

- **Shared store: a single `transcript_segments` table keyed by `stream_id`.** Rows
  are `{ id, stream_id, start_s, end_s, text, created_at }`. RLS mirrors the AZ-111
  split: `select using (true)` (public-read, same as `chat_messages`/`streams`), no
  insert/update policies → **service-write only** via the worker's secret key. A
  VOD's transcript is obtained by joining `videos.source_stream_id` →
  `transcript_segments.stream_id`, so there is **no `video_id` column to backfill**
  at VOD finalization. *Alternative — `transcripts` header + segments child:* extra
  table for no benefit at this scope; a flat segment table is enough. *Alternative —
  store on R2 as a JSON/SRT blob:* loses queryability (the chat bot needs a rolling
  window; subtitles need range queries) — keep it relational.

- **Audio source: the worker `ffmpeg`-pulls the public HLS.** (AZ-119 / confirmed.)
  `ffmpeg -i $NEXT_PUBLIC_STREAM_HOST/owner/index.m3u8` in rolling chunks →
  mono 16 kHz PCM → `whisper-cli`. No changes to the MediaMTX VM; the worker is
  already local for `claude -p`. Latency is ~one HLS segment (a few seconds), fine
  for transcript context and subtitles. *Alternatives — VM-side whisper* (adds
  load + model deploy to the streaming box, splits the worker across machines) or
  *tap local OBS* (lowest latency but couples to one local setup, brittle for
  self-host) were rejected.

- **Timestamps are stream-relative seconds; VOD reconciliation is a stored offset,
  not a rewrite.** `start_s`/`end_s` are seconds from the worker's first transcribed
  HLS chunk (≈ `streams.started_at`). For the live chat-scoring use this is exactly
  right. For VOD playback (AZ-116) the VOD timeline may not be t=0 at stream start
  (preview period, recording start). Rather than mutate every segment, the VOD
  consumer applies a single offset = (VOD start − transcript origin). This change
  **records the transcript origin** (the wall-clock time of the first chunk, derived
  from `started_at`) so the later subtitle/shorts work can compute that offset; it
  does not build the VOD-side mapping itself. *Alternative — store absolute
  timestamptz per segment:* heavier rows; a single origin + relative offsets is
  sufficient and cheaper.

- **Gating: reuse `chat_scoring_state.enabled` as the "engage this stream" flag.**
  The worker transcribes the owner's currently-live stream only when
  `chat_scoring_state.enabled` is true for it (the same toggle the studio overlay
  page already writes). Rationale: transcription exists to serve scoring + featuring;
  one switch the owner already understands avoids a second control surface, and the
  `locked_until` column on that table is the mutex preventing two worker instances
  from double-transcribing. *Alternative — a dedicated `transcription_enabled` flag:*
  warranted once subtitles are wanted without scoring, but premature now; note it as
  a future split. The worker finds the live stream via the existing query
  (most-recent `streams` row for the owner's channel with fresh `last_seen_at`).

- **Migration + types follow the repo norm.** `npx supabase migration new
  add_transcript_segments` (never hand-authored), `npx supabase db push` **after
  owner OK** (hits production), then `npm run db:types`. Add the
  `TranscriptSegment` Row type to `app/layout.types.ts`.

## Risks / Trade-offs

- [HLS-pull transcription drifts or stalls if segments are dropped] → The worker
  transcribes chunks idempotently and advances a cursor (`chat_scoring_state.last_scored_at`
  is the scoring cursor; transcription tracks its own last-processed segment time in
  memory + can resume from `max(end_s)` for the stream). A gap is acceptable — a
  missed few seconds of transcript only weakens context, never corrupts state.
- [Two worker instances run at once] → `chat_scoring_state.locked_until` is the
  mutex; the worker takes/renews the lock before transcribing and exits if held.
- [Stream-relative timestamps vs VOD timeline] → Resolved as a deferred single-offset
  reconciliation (see Decisions); this change stores enough (origin via `started_at`)
  to compute it later, and explicitly does not build the VOD mapping.
- [Binaries absent on the worker machine] → the `doctor` command verifies
  `whisper-cli` + model, `ffmpeg`, `claude`, and Supabase reachability before any job
  runs, failing loudly with remediation.
- [Migration hits production] → additive (one new table, no changes to existing
  schema); gated on explicit owner OK before `db push`, verified by read-back.

## Migration Plan

1. `npx supabase migration new add_transcript_segments`; author the table + RLS +
   public-read policy in the generated file.
2. Get owner OK, then `npx supabase db push` (production), then `npm run db:types`.
3. Build `worker/`; verify with `worker doctor` and a live (or replayed) HLS source
   that segments land in `transcript_segments` and are publicly readable but not
   publicly writable.
4. Rollback: the table is additive and unreferenced by the app; dropping it (a new
   migration) fully reverts. The worker is not deployed — stopping the process is the
   only "rollback" needed for the runtime half.

## Open Questions

- Exact HLS chunk length vs whisper batch size (latency vs accuracy) — tune during
  implementation; not a spec-level decision.
- Whether a dedicated `transcription_enabled` flag replaces the reused
  `chat_scoring_state.enabled` once subtitles-without-scoring is wanted — deferred to
  the AZ-116 work.
