# Tasks: add-channel-branding

> Follow `CLAUDE.md` + `docs/template_files/`. No comments; throw-on-error
> (`console.error`); `cn` from `@/lib/utils`; co-located `page.*`; Zustand for
> client state; React Query hooks call actions; browser client for auth/realtime;
> server client (publishable key) for table queries; admin client only when a
> server action needs to bypass RLS deliberately. No middleware. Remote-only
> Supabase: create migrations with `npx supabase migration new <name>` (never
> hand-write filenames), push with `npx supabase db push`, regenerate types
> after. Verify with `npx tsc --noEmit` / `npm run lint` / `npm run build:local`
> — do NOT start a dev server. RLS on every new policy surface.

## 1. Schema & types

- [x] 1.1 `npx supabase migration new channel_branding_columns`; add
  `avatar_path text null` and `banner_path text null` to `public.channels`. No
  defaults, no constraints beyond nullable.
- [x] 1.2 `npx supabase db push`; regenerate types
  (`npx supabase gen types typescript --project-id <ref> > supabase/types.ts`).

## 2. Supabase Storage bucket + RLS

- [x] 2.1 `npx supabase migration new channel_assets_bucket`; in it:
  - Create the bucket via `insert into storage.buckets (id, name, public,
    file_size_limit, allowed_mime_types) values ('channel-assets',
    'channel-assets', true, 5242880, array['image/jpeg','image/png',
    'image/webp']);` (idempotent via `on conflict do nothing`).
  - Add three policies on `storage.objects` for the bucket — INSERT, UPDATE,
    DELETE — each `to authenticated` with check (or using) that
    `bucket_id = 'channel-assets'` and
    `((storage.foldername(name))[1])::uuid in (select id from public.channels
    where owner_user_id = (select auth.uid()))`. Public SELECT is implicit from
    `public = true`; no SELECT policy.
- [x] 2.2 `npx supabase db push`.
- [x] 2.3 Extend `supabase/rls-check.ts`:
  - Owner can upload to `<their_channel_id>/test.jpg` and delete it.
  - Non-owner authenticated user cannot upload to that path.
  - Anonymous user cannot upload anywhere in the bucket.
  - Public GET of an uploaded object via the public URL returns 200.

## 3. Render the uploaded branding on the channel page

- [x] 3.1 In `app/[channelSlug]/page.tsx`, replace the hardcoded
  `/channel-banner.jpg` and `/channel-avatar.jpg` references with URLs derived
  from `channel.banner_path` and `channel.avatar_path`. Use a tiny helper
  `channelAssetUrl(path)` that returns
  `${NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/channel-assets/${path}`
  (export from `lib/storage.ts` or co-locate on the page — pick one and keep
  consistent with `VOD_BASE_URL` precedent).
- [x] 3.2 Preserve the existing fallbacks: if `banner_path` is null, render
  the gradient div with no `<img>`; if `avatar_path` is null, the shadcn
  `AvatarFallback` (initials) already covers that case.
- [x] 3.3 Remove the page-level `bannerErrored` state once the path is
  null-checked at render time (the `onError` fallback was only needed while the
  `/public/` files might be missing; with DB-driven paths a null check is enough).

## 4. Owner detection

- [x] 4.1 In `app/layout.hooks.tsx`, add `useIsChannelOwner(channel: Channel |
  null | undefined)`: returns `false` when channel or current user is missing;
  returns `channel.owner_user_id === user.id` otherwise. (Co-located with
  `useIsOwner` — they answer different questions.)
- [x] 4.2 Use the hook in `app/[channelSlug]/page.tsx` to conditionally render
  the upload icon buttons on banner and avatar.

## 5. Upload action

- [x] 5.1 `app/[channelSlug]/page.actions.ts`: add
  `uploadChannelBrandingAction(channelId, kind, formData)` where
  `kind: 'avatar' | 'banner'`:
  - `auth.getUser()` — throw if no user.
  - SELECT the channel; throw if it does not exist or `owner_user_id` does not
    match the authenticated user.
  - Read `file` from `formData`; validate `file instanceof File`, MIME in
    allowlist (`image/jpeg`, `image/png`, `image/webp`), and size ≤ 2 MB for
    avatar / ≤ 5 MB for banner.
  - Build path: `${channelId}/${kind}-${Date.now()}.${ext}` where `ext` is
    derived from the MIME (`image/jpeg` → `jpg`, `image/png` → `png`,
    `image/webp` → `webp`).
  - Upload via `supabase.storage.from('channel-assets').upload(path, file, {
    contentType: file.type, cacheControl: 'public, max-age=31536000, immutable',
    upsert: false })`.
  - Read the channel's previous `<kind>_path` from the SELECT above; UPDATE the
    channel row to the new path; if the previous path is non-null, best-effort
    `storage.from('channel-assets').remove([previousPath])` after the row
    update — log on failure, do not throw.
  - Return the new path string.

## 6. Upload hook

- [x] 6.1 `app/[channelSlug]/page.hooks.tsx`: add `useUploadChannelBranding()` —
  a `useMutation` that calls the action. On success, invalidate `['channel',
  slug]` and show a success toast via `sonner` + `CustomToast`; on error, show
  an error toast with the thrown message.

## 7. Dialog + dropzone component

- [x] 7.1 `npm install react-dropzone` (no peer-dep gotchas with React 19).
- [x] 7.2 `components/branding-upload-dialog.tsx` — a client component:
  - Props: `open`, `onOpenChange`, `channelId`, `kind`.
  - Renders a shadcn `Dialog` with a title (`Upload avatar` / `Upload banner`),
    a description with recommended dimensions and size cap, and a dropzone.
  - Dropzone: `useDropzone` from `react-dropzone` configured with `accept: {
    'image/jpeg': [], 'image/png': [], 'image/webp': [] }`, `maxFiles: 1`, and
    `maxSize` of `2 * 1024 * 1024` for avatar / `5 * 1024 * 1024` for banner.
    Spread `getRootProps()` onto the drop target and `getInputProps()` onto a
    nested `<input />`. Style the drop target based on `isDragActive` /
    `isDragReject` from the hook.
  - On a successful drop (`onDrop` callback with one accepted file), call the
    upload mutation; close the dialog on success. If `fileRejections` is
    non-empty, surface an inline rejection message (e.g. "PNG, JPG, or WebP up
    to 5 MB") without closing the dialog.
  - While the mutation is pending, show a spinner inside the dropzone and
    disable further drops/clicks. On a thrown error keep the dialog open and
    surface an error toast so the user can retry.
- [x] 7.3 Use existing icons from `lucide-react` (e.g. `Upload`, `ImageIcon`).

## 8. Upload icon buttons on the channel page

- [x] 8.1 In `app/[channelSlug]/page.tsx`, when `useIsChannelOwner(channel)` is
  true, render two icon buttons:
  - One absolutely positioned at the bottom-right of the banner div (over the
    image, with a translucent background, `Camera` or `Upload` icon).
  - One at the bottom-right of the avatar (smaller, badge-like).
  - Each opens `BrandingUploadDialog` with the appropriate `kind`. Use local
    `useState` for the two open flags (no Zustand needed — short-lived UI
    state).

## 9. Verify

- [x] 9.1 `npx tsc --noEmit` clean. `npm run lint` clean (or only known-allowed
  warnings). `npm run build:local` passes.
- [x] 9.2 Run the extended `supabase/rls-check.ts` against the remote DB; all
  pass.
- [x] 9.3 Manual smoke (channel owner signed in):
  - Open `/<slug>`; confirm the upload icons appear over the banner and the
    avatar.
  - Drop a JPG onto each dropzone; confirm the dialog closes, a success toast
    fires, and the new image renders without a page reload.
  - Open a private window (signed out); confirm no upload icons render.
  - Confirm the previous storage object was deleted (Supabase dashboard
    → Storage → `channel-assets`).
  - Try uploading a non-image and an oversized file from the file picker;
    confirm the action rejects with a useful error toast.
- [x] 9.4 No Playwright additions in this slice (UI is owner-only; covered by
  manual smoke).
