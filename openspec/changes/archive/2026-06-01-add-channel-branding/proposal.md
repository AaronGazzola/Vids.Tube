## Why

The channel page now has a YouTube-style layout (banner + avatar + header), but
the images are static files in `/public/` — the same image for every channel.
This change lets the channel owner upload their own avatar and banner from the
channel page, with the assets stored per-channel in Supabase Storage and rendered
from a public CDN URL. It is a small, owner-only slice; it does not introduce
moderation, image transforms, or any viewer-facing change beyond seeing the
images the owner uploaded.

## What Changes

- Add **`avatar_path` and `banner_path` columns** (both `text null`) to the
  `channels` table, plus a regeneration of the generated Supabase types.
- Add a **Supabase Storage bucket** `channel-assets`, public-read, with
  bucket-enforced MIME (`image/jpeg`, `image/png`, `image/webp`) and a 5 MB cap.
- Add **storage RLS policies** on `storage.objects` so that INSERT/UPDATE/DELETE
  under `channel-assets/<channel_id>/…` are allowed only to the user who owns the
  channel (public SELECT, since the bucket is public).
- Add a **server action** `uploadChannelBrandingAction(channelId, kind, formData)`
  that authenticates the user, verifies channel ownership, validates the file
  (MIME + size), uploads to `channel-assets/<channel_id>/<kind>-<unix_ms>.<ext>`,
  updates the channel row, and best-effort deletes the previously-pointed-at
  object.
- Add a **React Query mutation** `useUploadChannelBranding()` that calls the
  action and invalidates the channel query on success.
- Add a **dialog + dropzone UI**: clicking the upload icon opens a shadcn `Dialog`
  containing a `react-dropzone` dropzone (drag-and-drop + click-to-pick) scoped
  to the image MIME allowlist. A successful drop uploads immediately and closes
  the dialog with a toast.
- Add **owner-only upload icon buttons** on the channel page, positioned at the
  bottom-right of the banner and the bottom-right of the avatar. They are shown
  only when the signed-in user owns the channel being viewed.
- Make the channel page **render branding from the DB** (`avatar_path` /
  `banner_path` → Supabase public URL), falling back to the existing gradient
  banner and initials avatar when either is null.
- Add a small **`useIsChannelOwner(channel)`** helper (in `app/layout.hooks.tsx`,
  alongside `useIsOwner`) that compares the current user id to
  `channel.owner_user_id`.

## Capabilities

### Modified Capabilities
- `channels`: gains optional branding fields on the channel record, an
  owner-only upload flow, and a render rule that uses the uploaded asset when
  present and the default placeholder when not.

## Impact

- **Schema:** two new `text null` columns on `channels`; new Supabase Storage
  bucket `channel-assets` (public, MIME + size limited); new `storage.objects`
  RLS policies for that bucket. Generated types regenerated.
- **App code:** new action + hook + dialog/dropzone component + upload icon
  buttons; the channel page reads `avatar_path` / `banner_path` instead of the
  hardcoded `/public/` paths; `app/layout.hooks.tsx` gains `useIsChannelOwner`.
  `components/video-card.tsx` / `components/video-grid.tsx` unchanged.
- **New dependency:** `react-dropzone` (small, MIT, ~5 KB gzipped) for the
  upload dropzone. The upload itself uses the existing `@supabase/supabase-js`
  client.
- **Storage cost:** negligible (Supabase Storage's free tier covers far more
  than two ~1 MB images per channel; v1 has one channel). Branding does not
  touch R2 or `cdn.vids.tube`.
- **No new secrets.** The Supabase URL and publishable key are already wired.
- **Verification:** `npx tsc --noEmit`, `npm run lint`, `npm run build:local`,
  extend `supabase/rls-check.ts` to assert the storage policies (owner can write
  under their channel folder; non-owner / anonymous cannot), and a brief manual
  smoke test on the channel page (upload both image kinds, confirm the new
  images render after the dialog closes and the previous object is gone from
  the bucket).
