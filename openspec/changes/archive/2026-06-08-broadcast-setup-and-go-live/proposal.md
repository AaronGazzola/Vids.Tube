## Why

A live stream today is born the instant the encoder connects (the ingest `live` hook writes a `streams` row straight to `status='live'`), with no title, description, or thumbnail — and nothing in the app can set them, because going live is triggered by the encoder, not by an owner action. So streams are untitled and the VODs they produce inherit a null title plus only a machine-extracted thumbnail. This is the prerequisite for scheduled streams (AZ-28) and advance ticket booking (AZ-38).

## What Changes

- **BREAKING (go-live behavior):** Going live becomes a **two-step "Preview" gate** (copying YouTube). The encoder connecting puts the stream in a new **private `preview`** state — HLS flows so the owner can self-preview in Studio, but viewers never see a `preview` stream. The owner sets the title/description/thumbnail and clicks **Go live** (an owner-only app action, **disabled until a non-empty title** is set) to flip `preview → live` (public). The encoder can no longer make a stream public on its own.
- Add `description` and `thumbnail_path` columns to `streams`, and a `preview` value to the status lifecycle: `idle → preview → live → ended`.
- Owner can upload a **custom thumbnail** for the broadcast; it is stored in **R2/CDN** (resolved by the existing `vodUrl()`) and **overrides** the VM auto-extracted thumbnail on the resulting VOD.
- The Studio `/studio/live` page becomes a real control surface: preview player + setup form + **Go live** when in `preview`; "You're live" + viewer count + **End** when `live`.
- The VOD created on stream end **inherits** the broadcast's `title`, `description`, and `thumbnail_path`.
- A `preview` session that disconnects without ever going live is discarded and produces **no VOD**.
- Privacy/visibility tiers are **deferred** — every broadcast is public in v1.

## Capabilities

### New Capabilities

- `broadcast-setup`: the owner-facing broadcast control surface — the preview→Go-live→End flow, the title-required go-live gate, broadcast metadata authoring (title/description), and custom thumbnail upload to R2.

### Modified Capabilities

- `stream-pipeline`: the ready hook now lands a session in private `preview` (not public `live`); promotion to public `live` is an explicit owner action; a `preview` session that ends without going live leaves no public artifact.
- `vod-recording`: the processing VOD inherits the broadcast's `description` and `thumbnail_path` (not just `title`), and the recording-complete hook must not overwrite an owner-set custom thumbnail with the auto-extracted one.
- `studio`: the Go Live tool changes from a disabled placeholder to the real preview/go-live/end experience.
- `channel-live`: the channel page treats only `live` (not `preview`) as publicly live, and displays the live broadcast's title (and description) near the player.
- `vod-playback`: the watch page shows the VOD's inherited description below the title.

## Impact

- **Schema/migration:** `streams` gains `description`, `thumbnail_path`, and a `preview` status value; regen `supabase/types.ts`.
- **Ingest:** `app/api/ingest/live/route.ts` (land `preview`), `app/api/ingest/offline/route.ts` (inherit description/thumbnail into the VOD; preview-only sessions create no VOD), `app/api/ingest/recording/route.ts` (don't clobber a custom thumbnail); `lib/stream.ts` (`decideGoLive` preview handling).
- **Actions/hooks:** new `goLiveAction` (preview→live, title required), `endStreamAction`, and a thumbnail-upload action writing to R2 via `@aws-sdk/client-s3`; consuming react-query hooks; `getLiveStreamAction`/`useLiveStream` treat `preview` as not-publicly-live.
- **UI:** `app/studio/live/*`, `components/live-stage.tsx` / `components/channel-view.tsx` (live title; preview hidden from viewers).
- **Tests:** unit (`decideGoLive` preview + title-required guard) and e2e (`tests/e2e/live-vod.spec.ts`: preview not shown publicly, Go-live requires a title, live shows the title, VOD inherits title/thumbnail) using the owner-channel-aware + cleanup patterns already in that file.
- **Related Linear:** new prerequisite ticket; unblocks AZ-28 (scheduling) and AZ-38 (paid tickets).
