## 1. Data model

- [ ] 1.1 Create the migration with `npx supabase migration new add_transcript_segments` (do not hand-create the file)
- [ ] 1.2 `transcript_segments`: `id uuid pk default gen_random_uuid()`, `stream_id uuid not null references streams(id) on delete cascade`, `start_s double precision not null`, `end_s double precision not null`, `text text not null`, `created_at timestamptz not null default now()`; index on `(stream_id, start_s)`
- [ ] 1.3 Enable RLS; add a single `select using (true)` policy (public-read), no insert/update policies → service-write only via the secret key
- [ ] 1.4 Get owner OK, then `npx supabase db push` (production), then `npm run db:types` to regenerate `supabase/types.ts`
- [ ] 1.5 In `app/layout.types.ts` add a `TranscriptSegment = Database["public"]["Tables"]["transcript_segments"]["Row"]` type

## 2. Worker scaffold (`worker/`)

- [ ] 2.1 `worker/package` wiring: a `worker` npm script (e.g. `doppler run -- tsx worker/index.ts`) and a `worker:doctor` script; confirm `tsx` runs `worker/` outside the Next build
- [ ] 2.2 `worker/config.ts`: read + validate required env (`SUPABASE_SECRET_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_STREAM_HOST`, `WHISPER_BIN`, `WHISPER_MODEL`, `CLAUDE_BIN`, `FFMPEG_BIN`), failing fast on missing values
- [ ] 2.3 `worker/lib/exec.ts`, `worker/lib/claude.ts` (`runClaude` = `claude -p`), `worker/lib/whisper.ts`, `worker/lib/ffmpeg.ts`: port from `../AI VOD generator/src/lib`, trimmed to what transcription needs (audio extract + `whisper-cli` invocation)
- [ ] 2.4 `worker/supabase.ts`: re-export the app's `supabaseAdmin` (from `@/supabase/admin-client`) and `Database` types for worker use
- [ ] 2.5 `worker/index.ts`: dispatcher loop — resolve the eligible live stream, check the gate, invoke the transcription job module; structured so future job modules are added as siblings under `worker/jobs/`
- [ ] 2.6 `worker/doctor.ts` + entry: verify `whisper-cli` + model, `ffmpeg`, `claude`, and Supabase reachability; print per-check pass/fail and exit non-zero on any failure

## 3. Live transcription job

- [ ] 3.1 `worker/jobs/transcribe.ts`: resolve the owner's live stream (most-recent `streams` row with fresh `last_seen_at`) and gate on `chat_scoring_state.enabled`; acquire/renew the `chat_scoring_state.locked_until` mutex and exit if held by another instance
- [ ] 3.2 Determine the resume point: query `max(end_s)` of existing `transcript_segments` for the stream; set the transcript origin from `streams.started_at`
- [ ] 3.3 Pull the public HLS (`${NEXT_PUBLIC_STREAM_HOST}/owner/index.m3u8`) with `ffmpeg` in rolling chunks → mono 16 kHz PCM (reuse `worker/lib/ffmpeg.ts`)
- [ ] 3.4 Run `whisper-cli` (large-v3-turbo) on each chunk (reuse `worker/lib/whisper.ts`); map whisper offsets to stream-relative `start_s`/`end_s` using the chunk's position after the resume point
- [ ] 3.5 Insert `{ stream_id, start_s, end_s, text }` rows via `supabaseAdmin`; skip/contiguously-advance so a restart does not duplicate earlier segments
- [ ] 3.6 Loop while the stream stays live + enabled; stop cleanly when it ends, `enabled` flips false, or the lock is lost

## 4. Verification

- [ ] 4.1 `npx tsc --noEmit` and `npx eslint` pass for the new worker files and `app/layout.types.ts`
- [ ] 4.2 `worker doctor` reports correct pass/fail (verify by temporarily pointing a binary path at a missing file)
- [ ] 4.3 Run the transcription job against a live or replayed HLS source (an `ffmpeg`-served `index.m3u8`) with an `enabled` `chat_scoring_state` row; confirm `transcript_segments` rows appear with increasing `start_s`, and a restart resumes after `max(end_s)` without duplicates (a `doppler run -- tsx` script, then clean up test rows)
- [ ] 4.4 Confirm RLS via the anon client: `transcript_segments` is publicly readable; insert/update without the secret key is denied
