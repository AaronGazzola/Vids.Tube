## 1. Data model

- [x] 1.1 Create the migration with `npx supabase migration new add_transcript_segments` (do not hand-create the file)
- [x] 1.2 `transcript_segments`: `id uuid pk default gen_random_uuid()`, `stream_id uuid not null references streams(id) on delete cascade`, `start_s double precision not null`, `end_s double precision not null`, `text text not null`, `created_at timestamptz not null default now()`; index on `(stream_id, start_s)`
- [x] 1.3 Enable RLS; add a single `select using (true)` policy (public-read), no insert/update policies → service-write only via the secret key
- [x] 1.4 Get owner OK, then `npx supabase db push` (production), then `npm run db:types` to regenerate `supabase/types.ts`
- [x] 1.5 In `app/layout.types.ts` add a `TranscriptSegment = Database["public"]["Tables"]["transcript_segments"]["Row"]` type

## 2. Worker scaffold (`worker/`)

- [x] 2.1 `worker/package` wiring: a `worker` npm script (`doppler run -- tsx worker/index.ts`) and a `worker:doctor` script; `tsx` runs `worker/` outside the Next build (resolves the `@/` alias via tsconfig paths)
- [x] 2.2 `worker/config.ts`: read + validate env — secrets/host required and fail fast (`SUPABASE_SECRET_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_STREAM_HOST`); binary paths (`WHISPER_BIN`/`WHISPER_MODEL`/`CLAUDE_BIN`/`FFMPEG_BIN`) optional with defaults so `doctor` can report them rather than crash on import
- [x] 2.3 `worker/lib/exec.ts`, `worker/lib/claude.ts` (`runClaude` = `claude -p`), `worker/lib/whisper.ts`, `worker/lib/ffmpeg.ts`: ported from `../AI VOD generator/src/lib`, trimmed to what transcription needs (HLS audio segmenter + `whisper-cli` → JSON segments)
- [x] 2.4 `worker/supabase.ts`: re-export the app's `supabaseAdmin` (from `@/supabase/admin-client`) and `Database` types for worker use
- [x] 2.5 `worker/index.ts`: dispatcher loop — resolve the eligible live stream, take the lock, invoke the transcription job module; structured so future job modules are added as siblings under `worker/jobs/`. Stream resolution + lock helpers in `worker/lib/streams.ts`
- [x] 2.6 `worker/doctor.ts` + entry: verify `whisper-cli` + model file, `ffmpeg`, `claude`, and Supabase reachability; print per-check PASS/FAIL and exit non-zero on any failure

## 3. Live transcription job

- [x] 3.1 `worker/jobs/transcribe.ts` + `worker/lib/streams.ts`: resolve the live stream (most-recent fresh `streams` row) and gate on `chat_scoring_state.enabled`; `tryAcquireLock`/`renewLock`/`releaseLock` on `chat_scoring_state.locked_until`, skipping if held by another instance
- [x] 3.2 Determine the resume baseline: `max(end_s)` of existing `transcript_segments` combined with the wall-clock position from `streams.started_at`, so the worker never writes before what's already stored
- [x] 3.3 Pull the public HLS (`${NEXT_PUBLIC_STREAM_HOST}/${STREAM_MTX_PATH}/index.m3u8`) with `ffmpeg` as rolling mono 16 kHz PCM chunks via the segment muxer (reuse `worker/lib/ffmpeg.ts`)
- [x] 3.4 Run `whisper-cli` on each completed chunk (reuse `worker/lib/whisper.ts`); map whisper offsets to stream-relative `start_s`/`end_s` via `baseline + chunkIndex * chunkSeconds + segmentOffset`
- [x] 3.5 Insert `{ stream_id, start_s, end_s, text }` rows via `supabaseAdmin`; advance `processedIndex` and use the resume baseline so a restart does not duplicate earlier segments
- [x] 3.6 Loop while the stream stays live + enabled; stop cleanly when it ends, `enabled` flips false, the segmenter exits, or the lock is lost (kill ffmpeg + remove the temp dir in `finally`)

## 4. Verification

- [x] 4.1 `npx tsc --noEmit` and `npx eslint` pass for the new worker files and `app/layout.types.ts`; `npm run build` compiles with the new `worker/` dir present
- [x] 4.4 Confirm RLS via the anon client: `transcript_segments` is publicly readable; insert/update without the secret key is denied (`scripts/verify-transcript-segments.ts` → anon insert denied `42501`, service write+read+cleanup ok)

> Reconciliation (2026-07-04): removed 2 live/owner-run verification task(s) per governance rule 2 (non-code work leaves the change). They are tracked in Linear as live-verify tickets.
