# AI_HANDOVER_DELETE_AFTER_READING — 2026-07-04

Context for a fresh AI chat. Delete this file after reading. The main audience is the
owner going live tonight with the Vids.Tube go-live overlay stack.

---

## For the next AI: current state (read first)

- **Branch/deploy:** everything is on `main` at `ec5a50b`, pushed; Vercel auto-deploys `main`.
  Nothing is pending unpushed.
- **What just shipped (recent commits):** VOD replay renders both origins (YouTube +
  Vids.Tube); Control Room unified into the single stream hub (`/studio/control`) with
  Setup + Overlay preview + test-mode banner; per-message score-breakdown persisted +
  Control Room "why?" view; click-to-promote highlights; AI moderation (manual/auto,
  default auto); the full VOD-finalize pipeline fix.
- **OpenSpec:** 0 active changes; `openspec/specs/` is the source of truth; 16 changes were
  archived this cycle. Do not "re-implement" from archived changes.
- **Linear:** the only open tickets are live-test verification (see below) plus deferred
  backlog. Backlog lives in Linear, team "Az", project "Vids.Tube".
- **The one owner-run step left:** deploy the VM finalize script (`AZ-88`) and run the live
  rehearsal. Everything else non-live is done and verified offline.
- **Conventions:** remote-only Supabase via Doppler (`doppler run -- ...`); do not run a dev
  server (owner runs their own on localhost:3000); verify via `tsc`/`eslint`/`build:local` +
  `npm run dryrun`; commit only when asked; migrations hit PROD and need explicit owner OK.

### Pipeline caveat (important, not yet verified live)

- The VOD finalize fix is committed but the VM script (`scripts/vm/mtx-finalize-vod.sh`) is
  **not yet deployed** to the Hetzner VM, and none of it is verified against a real recording.
- Finalize now binds a recording to the exact stream via a `recordedAt` timestamp the VM
  sends; the app matches the stream whose window contains it + `source_stream_id`, with an
  idempotency guard and a legacy "newest processing" fallback. Channel resolution is
  centralized in `resolveIngestChannel(mtxPath)` (path-keyed, single-owner fallback) — this
  is the seam that makes the pipeline multi-channel-ready; true multi-streamer still needs
  per-channel stream keys.
- Related Linear: `AZ-104` (wrong-row), `AZ-90` (orphaned preview), `AZ-88` (VM deploy),
  `AZ-22` (empty preview_paths — same stale-script deploy).

### Live-verify Linear tickets (tonight's rehearsal)

- `AZ-123` worker live (doctor + HLS transcription), `AZ-126` chat overlay live,
  `AZ-127` chat-scoring live, `AZ-128` goal overlays live, `AZ-129` avatar competition live.
- `AZ-137` reasoning "why?" view, `AZ-138` unified Control Room hub (both dry-run-runnable).
- `AZ-146` non-live UI checks (live-page routing + chat length/wrap).

---

## Going live overview

### The read-this to highlight flow

- Yes, that is exactly how it works, and you are the gate.
  1. The bot scores every chat message from both YouTube and Vids.Tube.
  2. The best ones appear in the Control Room "Read this (AI picks)" panel, each with the
     message text, author, the AI's reason, and category tags.
  3. You click "Show on overlay" on one you like.
  4. That message renders as a card in the chat-highlight overlay on stream.
  5. The "x" dismisses a pick without showing it.
- Nothing auto-appears in the highlight overlay; only what you click is shown.

### The three overlays (OBS browser sources)

- Chat highlight: `/overlay/{slug}` — shows the message card you promoted.
- Goals: `/overlay/{slug}/goals` — likes/subs/viewers bars from YouTube.
- Competition: `/overlay/{slug}/competition` — floating viewer avatars that grow and rank by score.

### Control Room (`/studio/control`) — your cockpit

- Setup section (collapsible):
  - YouTube broadcast URL input.
  - Featuring on/off toggle.
  - Goal targets plus Start.
  - The three OBS source URLs to copy.
  - Modbot manual/auto toggle.
- Live ops panels:
  - Live chat (both origins, with origin badges and profanity blur).
  - Read this (AI picks) with "Show on overlay".
  - Leaderboard, with a "why?" expander showing the AI's per-message score breakdown.
  - Moderation feed.
- Overlay preview (collapsible): draggable stage mirroring the live overlays.
- Pop out: whole room or per-panel into its own window for a second monitor.
- Test-mode banner: appears when the active stream is the dry-run.

### Scoring and moderation behavior

- Scoring: each message rated on engagement, humour, contribution; Vids.Tube weighted 1.5x over YouTube.
- Moderation modes:
  - Auto (default): auto-hides clear abuse and logs it; you can Unhide/Unban.
  - Manual: the bot only suggests; you Approve or Dismiss.
- Moderation items show sender, message, reason, and origin badge.

### The worker — required, runs on your machine

- The overlays and Control Room are the deployed web app; the bot is a local worker you run.
- Without the worker running, there is no transcription, scoring, highlights, or moderation.
- Commands:
  - Preflight: `doppler run -- npm run worker:doctor` (confirms whisper, ffmpeg, claude).
  - Run: `doppler run -- npm run worker` (keep it running the whole stream).
- Cost: the worker calls `claude -p` per scoring batch, so a long stream incurs some Claude usage.

### Go-live setup sequence

1. OBS: simulcast to YouTube (RTMP) and Vids.Tube (RTMP to `stream.vids.tube`, path `owner`).
2. Control Room Setup: paste the YouTube broadcast URL (enables YT chat read plus goal metrics).
3. Control Room Setup: turn Featuring on; set goal targets and press Start; set modbot mode.
4. Add the three OBS browser sources using the copied URLs.
5. Start `doppler run -- npm run worker` locally.
6. Go live on both YouTube and Vids.Tube.

### Rehearsal before going live

1. `doppler run -- npm run worker:doctor` — expect all PASS.
2. `doppler run -- npm run dryrun` (add `-- --youtube <videoId>` to populate goals).
3. Open `/studio/control` — the test-mode banner should show; watch chat, scores, and AI
   picks populate against real Claude output.
4. Click "Show on overlay" on a pick; open `/overlay/{slug}` in a browser tab and confirm the card appears.
5. Open the goals and competition overlay URLs and confirm they render.
6. Stop the dry-run with Ctrl+C; it cleans up its test stream.

### Keep in mind tonight (rough edges)

- Tonight is the first real simulcast test; everything above is proven via dry-run, not
  against live OBS plus the real YouTube API. Expect to tweak.
- The worker must stay running; if it crashes, scoring and highlights stop until you restart it.
- YouTube chat and goals need the broadcast public and the URL set in Setup.
- VOD pipeline: the finalize/orphan fixes are committed but the VM finalize script is not yet
  deployed and is unverified live.
  - Consequence: a recorded VOD may attach to the wrong row or have missing dimensions/previews.
  - To end cleanly, stop OBS rather than only ending the session while OBS keeps pushing.
- Deploying the VM script (`AZ-88`) is the one owner-run step left; doing it at the rehearsal
  start verifies it against a real recording.
