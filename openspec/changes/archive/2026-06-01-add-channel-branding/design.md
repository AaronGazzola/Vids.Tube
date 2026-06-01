## Context

The channel page redesign (banner + avatar header) is in place but reads images
from `/public/channel-banner.jpg` and `/public/channel-avatar.jpg` — the same
files for any channel. This change makes the assets per-channel and lets the
owner upload them in-app. The schema is already multi-tenant-ready (`channels`
has `owner_user_id`); this change extends that model with two optional asset
columns and a small upload UI gated by ownership.

R2 is already wired (for VODs), Supabase is the auth/DB system, and the channel
page is a client component fetching the channel via React Query. Those three
facts shape the decisions below.

## Goals / Non-Goals

**Goals:**
- Channel owner can upload an avatar and a banner from the channel page.
- Visitors see whatever the owner uploaded; if either asset is unset, the page
  falls back to the existing gradient banner / initials avatar.
- Only the owner sees the upload icons; only the owner can write to their
  channel's storage path (enforced server-side and in storage RLS — defense in
  depth).
- The flow is invisible to non-owners and to anonymous viewers.

**Non-Goals:**
- Image cropping, rotation, or in-browser editing.
- Server-side image resizing / transforms / multiple renditions. (Supabase
  Storage Pro has transforms; v1 ships without them — the upload is stored
  as-is.)
- A separate Studio "Branding" page. The upload affordances live on the channel
  page itself, next to the asset they edit.
- A "remove image" button. Reset means uploading another image; explicit
  removal is a later UX add.
- Banner/avatar for *streams* or *videos* (out of scope; the channel record is
  the only owner of these assets).
- Migrating any existing storage path. There are no existing branding rows.

## Decisions

- **Supabase Storage, not R2.** Branding assets live in a Supabase Storage
  bucket (`channel-assets`, public-read), not in the R2 VOD bucket.
  *Rationale:* the auth/RLS story is the deciding factor — the owner identity is
  already a Supabase user, so a one-line `owner_user_id = auth.uid()` policy on
  `storage.objects` gates writes natively, and the browser/server can upload
  with the existing publishable key in one call. R2 would require either a new
  account-scoped token for presigned PUTs (broader blast radius than our current
  bucket-scoped VOD token) or a Vercel-side upload proxy (eats serverless
  bandwidth). The R2 $0-egress advantage matters for VODs (gigabytes per
  stream); for two ~1 MB images per channel served a few times per session it
  is sub-cent and not worth the extra infra.
  *Alternative considered:* R2 with a Next.js proxy route. Rejected on infra
  complexity for no measurable cost benefit at v1 scale.

- **Public bucket; ownership enforced on writes.** The bucket is public-read
  (matches the public channel page — avatars/banners are visible to anonymous
  viewers, same as the channel name). Storage RLS policies on `storage.objects`
  scope INSERT/UPDATE/DELETE to the path prefix `<channel_id>/` for the user who
  owns that channel (via a subquery into `channels`). Public SELECT is granted
  by making the bucket public; we do not add a SELECT policy.

- **Store the path, derive the URL.** Two new `text null` columns on `channels`:
  `avatar_path`, `banner_path`. The render layer constructs the public URL as
  `${NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/channel-assets/<path>`.
  *Rationale:* mirrors the `videos.mp4_path` + `NEXT_PUBLIC_VOD_BASE_URL` pattern
  established in `add-vod-pipeline`; the Supabase URL can change (project move)
  without a data migration.

- **Timestamped path scheme; old object cleanup is best-effort.** Path:
  `<channel_id>/avatar-<unix_ms>.<ext>` and `<channel_id>/banner-<unix_ms>.<ext>`.
  *Rationale:* embedding a timestamp in the path makes every upload a new object
  at a new URL, side-stepping the CDN-stale-image problem cleanly (the channel
  row's pointer flips atomically). After a successful upload + DB update, the
  action issues a best-effort delete of the previously-pointed-at object; if
  that delete fails, the object is orphaned and harmless — we log and proceed.
  *Alternative considered:* fixed path (`avatar.jpg`) with a `?v=<ts>` query
  string for cache-busting. Rejected: the query-string approach depends on
  consistent client-side URL construction everywhere the image is referenced;
  the timestamped path makes the URL the source of truth.

- **Server-action upload, not direct browser upload.** The action authenticates
  with `auth.getUser()`, verifies channel ownership via a `channels` SELECT,
  validates MIME + size, and uploads via the server-side client.
  *Rationale:* matches the action pattern in CLAUDE.md (table-side writes go
  through actions); centralises the MIME/size enforcement (still also enforced
  at the bucket level — defense in depth); avoids exposing storage-write
  semantics in the browser. The cost (file flows through a Vercel function) is
  bounded at ≤5 MB and is acceptable for an owner-only, low-frequency flow.

- **Dropzone via `react-dropzone`.** The dropzone is a client component built on
  `react-dropzone`'s `useDropzone` hook, configured with the image MIME
  allowlist (`accept: { 'image/jpeg': [], 'image/png': [], 'image/webp': [] }`),
  `maxFiles: 1`, and a per-kind `maxSize` (2 MB avatar, 5 MB banner). The hook
  yields the drag state (`isDragActive`, `isDragReject`) we use to style the
  drop target, and it gives us pre-validated `acceptedFiles` / `fileRejections`
  arrays we can hand directly to the upload mutation or surface as an inline
  error. The dep is small (~5 KB gzipped, MIT) and saves us from re-deriving the
  parts that get fiddly fast — multi-input keyboard accessibility, file-input
  ref management, MIME / size pre-filtering, and the drag-state edge cases
  (drag-leave on child elements, fail-state styling).

- **Owner check is per-channel, not global.** A new `useIsChannelOwner(channel)`
  helper compares `channel.owner_user_id` to the current user id. The existing
  `useIsOwner` is a global "is this user the platform owner" check used by the
  account menu; for the channel page we want the per-channel check, which keeps
  the multi-tenant schema honest even though v1 has one channel.

- **Both surfaces use the same dialog + dropzone.** The avatar and banner
  buttons open the same `BrandingUploadDialog` component parameterised by
  `kind: 'avatar' | 'banner'`. The dialog shows the recommended dimensions
  (avatar 400×400, banner 2560×512) and the size cap (2 MB avatar, 5 MB banner)
  as hint text. Per-kind size validation lives in the action.

- **Cache-control hints on upload.** When uploading, set the storage object's
  `cacheControl` to a long max-age (e.g. `'public, max-age=31536000, immutable'`)
  since the path is unique per upload. Without this, Supabase Storage defaults
  to a much shorter cache window and we'd pay for repeated 304s on assets that
  are now permanently named.

- **Bucket policy as the second wall.** Beyond the RLS policy on
  `storage.objects`, set the bucket's `allowed_mime_types` and
  `file_size_limit` so that a misbehaving (or malicious) client cannot upload a
  non-image even if it somehow got past the action.

- **Conventions per CLAUDE.md.** No comments; `console.error`-and-throw; React
  Query mutations call actions; the upload UI is co-located with the channel
  page (`app/[channelSlug]/page.*`) plus a `components/branding-upload-dialog.tsx`
  that has no page-specific knowledge; the new hook lives on the channel page
  (page-scoped), the per-channel ownership helper lives in `app/layout.hooks.tsx`
  (shared); RLS on every new policy surface; remote-only Supabase migrations.

## Risks / Trade-offs

- **Orphaned objects when delete fails.** Best-effort cleanup means a long tail
  of stale objects under a channel folder if the delete step intermittently
  fails. *Mitigation:* storage cost per orphan is trivial; if it ever matters,
  a periodic reconcile job comparing `channels.{avatar,banner}_path` to the
  bucket listing can prune them. Out of scope for v1.

- **Public bucket exposes paths to anyone with the URL.** This is by design (the
  channel page is public). There is no security secret in the URL; the
  defense-in-depth is on writes, not reads.

- **No image dimension / aspect validation.** A user could upload a tiny
  400×100 banner and the page would stretch it. *Mitigation:* hint text in the
  dialog states the recommended dimensions; we accept the result as-is for v1.
  If owner UX warrants it, a server-side dimension check (via Sharp) is a
  small follow-up.

- **MIME spoofing.** The browser-reported MIME and the file's actual content can
  diverge. The bucket policy uses the upload-time MIME, which is the client's
  claim. *Mitigation:* the bucket MIME allowlist plus a max size limit caps the
  worst case at "a 5 MB blob masquerading as image/png on a public CDN" — the
  same risk profile as any other public bucket. If this ever needs hardening,
  decoding the file server-side (Sharp) before upload is the path.

- **Cache-busting at the page level.** Because we render the public URL with the
  timestamped path embedded, and React Query invalidates the channel query on
  successful upload, the page swaps to the new image without a hard reload. No
  service-worker / CDN purge needed.

## Open Questions

- **Bucket-side image transforms vs. ship-as-uploaded.** Supabase Image
  Transformations (Pro tier) could downscale large uploads on the fly. Default
  for v1: skip — accept the upload as-is, document recommended dimensions.
  Revisit if owner uploads end up oversized in practice.

- **Move avatar/banner editing to a Studio page later?** Currently the upload
  icons live on the public channel page (shown only to the owner). A Studio
  "Branding" page would be a different surface and is not justified by v1
  scope. Leave on-page.

- **Default placeholders sourced from where?** Current code falls back to a
  gradient banner and initials avatar built from the channel name. We are
  keeping that fallback; no change needed.
