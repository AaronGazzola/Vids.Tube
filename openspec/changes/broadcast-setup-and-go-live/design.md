## Context

Going live is encoder-triggered: MediaMTX's ready hook POSTs `/api/ingest/live`, which (via `decideGoLive` in `lib/stream.ts`) writes a per-session `streams` row at `status='live'` — instantly public, untitled. The owner has no app-side moment to set metadata. `streams` has `title` (never set), no `description`/`thumbnail`. VODs are created by the offline hook (copying `liveStream.title`) and finalized by the recording hook (auto-extracted thumbnail). VOD media + thumbnails live in R2/CDN, resolved by `vodUrl()`; the app already has `@aws-sdk/client-s3` + R2 creds. Channel branding uploads use Supabase storage (`branding-upload-dialog.tsx`).

## Goals / Non-Goals

**Goals:**
- Every broadcast gets an owner-set title (guaranteed), plus optional description + custom thumbnail.
- A private preview state so the owner can set up before viewers see anything.
- VOD inherits the broadcast's title/description/thumbnail; custom thumbnail beats the auto one.

**Non-Goals:**
- Scheduling (start times, Broadcasts list page, countdown card) — AZ-28.
- Privacy/visibility tiers — deferred; everything public.
- Reminders/notifications — AZ-29.
- Auto-go-live.

## Decisions

- **Preview gate as a new `streams.status` value.** Lifecycle `idle → preview → live → ended`. The ready hook lands `preview`; an owner action promotes to `live`. This reuses the existing per-session row + `decideGoLive` machinery rather than adding a separate table.
  - *Alternative considered:* a separate `broadcasts` table — rejected; `streams` already carries the session identity (`source_stream_id`, `chat_messages.stream_id` FKs) and the per-session reconnect logic.
- **Go-live is an owner server action, not the encoder.** `goLiveAction` (preview→live, sets public `started_at`, requires non-empty title) + `endStreamAction` (→ended), both owner-auth'd, called from react-query mutation hooks. The title requirement is an **expected** error returned as `ActionResult` (per CLAUDE.md), surfaced as a toast — not a thrown error.
- **`decideGoLive` change:** "ongoing session" = most-recent row is `preview` OR `live` and fresh; new sessions are inserted as `preview`; stale `preview`/`live` rows are ended. Reconnect preserves `status` (a reconnect during `live` stays `live`; during `preview` stays `preview`).
- **Custom thumbnail → R2, not Supabase storage.** Upload via `@aws-sdk/client-s3` to the VOD bucket under a stream-scoped key (e.g. `live-thumb/<streamId>-<ts>.<ext>`), store the key in `streams.thumbnail_path`, render via `vodUrl()`. Keeps all thumbnail URLs uniform. The picker UI mirrors `branding-upload-dialog.tsx`, but the file goes to R2.
  - *Alternative considered:* Supabase `channel-assets` bucket (reuse branding upload verbatim) — rejected; it splits thumbnail resolution across two stores.
- **Custom-thumbnail precedence at finalize.** The offline hook copies `streams.thumbnail_path` onto the processing `videos` row. The recording hook sets `thumbnail_path` from the auto-extracted key **only if** the row's `thumbnail_path` is null — so a custom thumbnail survives.
- **Preview is owner-only on reads.** `getLiveStreamAction`/`useLiveStream` (public channel page) treat only `live` as live; `preview` reads as offline for viewers. Studio uses an owner-scoped read to self-preview the `preview` stream.
- **Preview-only sessions produce no VOD.** The offline hook creates the processing `videos` row only when the ending session had reached public `live` (e.g. has a public `started_at`/was `live`).

## Risks / Trade-offs

- **Recording includes the preview lead-in.** MediaMTX records from encoder-connect (`runOnReady`), so a long preview could appear at the head of the VOD. → For v1, accept a short lead-in; trimming to the public go-live timestamp is a VM-finalize concern noted for AZ-28. Mitigate UX by keeping previews short.
- **Encoder reconnect mid-preview** must not relaunch a public stream — handled by reconnect preserving `status='preview'`.
- **Owner forgets to go live** (streams in preview, never public) → no VOD, nothing public; correct behavior, but the Studio UI should make the Go-live affordance obvious.
- **Two-store thumbnails on display** are avoided by sending custom thumbnails to R2; the channel page/video card already resolve `vodUrl()`.

## Migration Plan

- Add `streams.description`, `streams.thumbnail_path`; extend the status check/enum to include `preview` (migration via `npx supabase migration new`, then `db push`, then regen types). No backfill — existing rows are `ended`/`live` and unaffected.
- Ship app + ingest changes together; the VM finalize script is unchanged (the app, not the VM, enforces custom-thumbnail precedence).
