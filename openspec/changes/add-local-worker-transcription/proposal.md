## Why

Vids.Tube needs a small amount of work done by tools that cannot run on Vercel —
`whisper.cpp`, `ffmpeg`, and the Claude **subscription** via `claude -p` (no API
key). The chat-scoring overlay (AZ-111, shipped) and the shorts creator being
merged in (AZ-119) both depend on a stream transcript, and both need that
out-of-process compute. This change stands up the **one local worker** that
provides it and lands the **shared transcript** it produces, so transcription
happens exactly once per stream and every later consumer (chat scoring, shorts,
VOD subtitles) reads the same segments.

## What Changes

- **New local worker process** (`worker/`, run with `tsx`, secrets via Doppler):
  the data plane to the deployed app's control plane. It holds
  `SUPABASE_SECRET_KEY` locally, reuses the app's `supabaseAdmin`, `Database`
  types, and `lib/r2.ts`, and provides ported `runClaude` (`claude -p`), `exec`,
  `whisper`, and `ffmpeg` wrappers from `../AI VOD generator/src/lib`. A thin job
  dispatcher keeps each future job (chat scoring, shorts) a separate module in one
  process, plus a `doctor` command that verifies the binaries, Supabase, and
  Claude CLI are reachable.
- **New shared transcript store**: a `transcript_segments` table keyed by
  `stream_id` (publicly readable where the stream is, **service-write only**). A
  VOD's transcript is reached by joining `videos.source_stream_id` →
  `transcript_segments.stream_id`, so no `video_id` backfill is needed.
- **Live transcription job**: the worker pulls the public HLS
  (`NEXT_PUBLIC_STREAM_HOST/owner/index.m3u8`) with `ffmpeg` in chunks, runs
  `whisper.cpp` (large-v3-turbo) locally, and appends `{ start_s, end_s, text }`
  segments in near-real-time while the stream is live and featuring is enabled.
- **No** `@anthropic-ai/sdk`, **no** `ANTHROPIC_API_KEY`, **no** scoring/LLM code
  in the deployed app. The worker is the only new writer; it uses the secret key.

- **Out of scope** (separate changes): the chat-scoring job (next change, consumes
  this transcript), shorts data model + editor (AZ-120), the shorts render pipeline
  (AZ-121), VOD subtitle UI (AZ-116), and native-signal-enriched analysis (AZ-122).

## Capabilities

### New Capabilities

- `local-worker`: the single out-of-process worker that runs the binaries and
  `claude -p` Vids.Tube can't run on Vercel — process scaffold, shared-client and
  binary-wrapper reuse, job dispatcher, and the `doctor` check. (Job logic beyond
  transcription is out of scope here.)
- `stream-transcription`: the shared `transcript_segments` data model and the
  worker's live transcription job — one whisper pass per stream, persisted once and
  read by every later consumer.

### Modified Capabilities

(none)

## Impact

- **DB**: one new migration (`npx supabase migration new add_transcript_segments`);
  `npm run db:types` regenerates `supabase/types.ts`. Migration push hits
  **production** Supabase — requires owner OK before `db push`.
- **New files**: `worker/` (process entry, dispatcher, config, `doctor`, transcription
  job, ported `lib/` wrappers); a new migration; types in `app/layout.types.ts`.
- **New deps/runtime**: the worker needs `whisper-cli` (+ large-v3-turbo model),
  `ffmpeg`, and the `claude` CLI on the machine that runs it; `@aws-sdk/*` is already
  present. Nothing new ships in the Next build.
- **Reuses**: `supabase/admin-client.ts`, `supabase/types.ts`, `lib/r2.ts`,
  `chat_scoring_state.enabled` (gating), `streams`/`videos` (the stream→video spine),
  and the `../AI VOD generator` `whisper`/`ffmpeg`/`claude`/`exec` wrappers.
- No changes to existing chat, streams, ingest, or overlay behavior.
