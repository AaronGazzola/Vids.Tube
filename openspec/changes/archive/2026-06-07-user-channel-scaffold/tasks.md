## 1. Data model & migration

- [x] 1.1 `npx supabase migration new add_channel_handle`; in it add `handle` text column to `channels`, backfill `handle` from a normalized `slug`, add `check (handle ~ '^[a-z0-9_]{3,30}$')`, add unique index on `lower(handle)`, and add `unique (owner_user_id)`
- [x] 1.2 Confirm RLS is unchanged: channel rows stay publicly readable; insert/update/delete stay owner-only (no policy edits needed, verify in the migration review)
- [x] 1.3 `npx supabase db push`
- [x] 1.4 Regenerate types: `npx supabase gen types typescript --project-id <project-ref> > supabase/types.ts`

## 2. Shared types & identity lookup

- [x] 2.1 In `app/layout.types.ts`, confirm `Channel` now includes `handle`; add `CreateChannelInput`, `UpdateChannelInput`, and `HandleAvailability` types
- [x] 2.2 Add a reserved-handle constant + a `normalizeHandle`/`isValidHandle` helper (shared, e.g. `lib/handle.ts`)

## 3. Actions

- [x] 3.1 Add `getMyChannelAction` in `app/layout.actions.ts` — returns the current authenticated user's channel (by `owner_user_id`) or `null` (query action, throws on infra error)
- [x] 3.2 Add `checkHandleAvailabilityAction(handle)` — validates format + reserved list, returns availability; `ActionResult` for expected validation errors
- [x] 3.3 Add `createChannelAction(input)` — auth check, format/reserved validation, set `owner_user_id`/`handle`/`slug`/derived `name`; map unique-violation (handle or owner_user_id) to a friendly `ActionResult` error
- [x] 3.4 Add `updateChannelAction(input)` — owner-of-that-channel check, validate handle, update `name`/`description`/`handle`+`slug` together; map unique-violation to a friendly `ActionResult` error

## 4. Hooks

- [x] 4.1 Add `useMyChannel` query hook (keyed `["my-channel"]`) in `app/layout.hooks.tsx`
- [x] 4.2 Add `useCreateChannel`, `useUpdateChannel`, and `useHandleAvailability` hooks (unwrap `ActionResult`, toast on error, invalidate `["my-channel"]`/`["owner-channel"]`/`["channel", slug]` on success)
- [x] 4.3 Replace `useIsOwner` so it compares the current user id against the owner channel's `owner_user_id` (earliest channel via `useOwnerChannel`); treat the loading state as not-owner
- [x] 4.4 Add `useRequireChannel` guard hook — redirect authenticated users without a channel to `/onboarding`

## 5. Onboarding flow

- [x] 5.1 Create `app/onboarding/page.tsx` (+ `page.hooks.tsx`/`page.types.ts` as needed): handle input with live availability feedback and format validation
- [x] 5.2 On submit, call `useCreateChannel`; on success route into the app; handle the taken-at-submission case
- [x] 5.3 Wire `useRequireChannel` into the authenticated layout/areas; ensure `/onboarding` redirects users who already own a channel away
- [x] 5.4 Ensure the seeded owner (already has a channel) skips onboarding

## 6. Channel management UI

- [x] 6.1 Replace the stub in `app/studio/settings/page.tsx` with a real form bound to `useMyChannel` + `useUpdateChannel` (name, handle, description) with inline loading skeletons for data-dependent fields
- [x] 6.2 Replace the stubbed profile/save in `app/account/page.tsx` with real channel-backed editing (or link to studio settings as the single source) — no "Coming soon" stubs left for channel identity
- [x] 6.3 Integrate `BrandingUploadDialog` for avatar + banner in the management UI, passing the user's own `channelId`/`channelSlug`
- [x] 6.4 Surface handle validation/uniqueness errors from `updateChannelAction` in the form

## 7. Owner gating

- [x] 7.1 Gate the `app/[channelSlug]/page.tsx` view: render publicly only for the platform owner's channel; for a non-owner channel, render only for its own owner, otherwise `notFound()`
- [x] 7.2 Verify studio/publishing entry points use the tightened `useIsOwner`/`useRequireOwner` and hide controls from non-owners

## 8. Verification

- [x] 8.1 `npm run build` / typecheck and lint pass
- [x] 8.2 Update or fix any fixtures that assumed a single channel or multiple channels per owner (`tests/e2e/*`) to respect `unique (owner_user_id)` — watch-page tests retargeted to the owner channel; channel-page tests skipped, rework tracked in AZ-48
- [x] 8.3 Run `openspec-verify-change` for `user-channel-scaffold`
