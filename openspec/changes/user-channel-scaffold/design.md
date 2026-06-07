## Context

The `channels` table (`supabase/migrations/20260523095142_channels.sql`) has `id, owner_user_id, slug (unique), name, description, created_at` plus `avatar_path/banner_path`. RLS makes rows publicly readable and restricts insert/update/delete to the owning user. There is exactly one channel today (the seeded owner channel, created by the `ADMIN_EMAIL`/`ADMIN_PASSWORD` seed).

There is no per-user identity: `useIsOwner` (`app/layout.hooks.tsx:37`) returns `isAuthenticated`, i.e. **every signed-in user is currently treated as the owner** — a single-user simplification that becomes incorrect the moment a second user can sign up and own a channel. `getOwnerChannelAction` returns the earliest-created channel. Comments/chat render `userId.slice(0, 8)`. `BrandingUploadDialog` + `uploadChannelBrandingAction` already provide owner-gated avatar/banner upload per channel.

Constraints (CLAUDE.md): no middleware — gating via RLS + react-query hooks; actions use the Supabase server client and the `ActionResult<T>` expected/unexpected error split; remote-only Supabase via CLI migrations; file-org by `page.*`/`layout.*` conventions.

## Goals / Non-Goals

**Goals:**
- One channel per user, each with a unique, validated `@handle`.
- Post-signup onboarding that forces a new authenticated user to claim a handle before using the app; their channel is provisioned on completion.
- Real channel-management UI (name, handle, description, avatar, banner) replacing the stubbed Account and Studio Settings screens.
- A correct platform-owner check so publishing and public channel-page viewing stay gated to the owner once multiple channels exist.
- A user→channel identity lookup that AZ-24 can consume to show @handle/name/avatar in comments and chat.

**Non-Goals:**
- Twitch-style explore / multi-channel public browse (AZ-31).
- Allowing non-owner accounts to publish live/VOD (future).
- Changing comment/chat rendering itself (AZ-24).
- Profile fields beyond channel identity (no separate bio/social-links table).

## Decisions

### Identity lives on `channels`, not a separate `profiles` table
Because the model is strictly **one channel per user**, the channel row already is the user's public identity. Adding a `profiles` table would duplicate name/avatar and force a join for every author lookup. Decision: enforce `unique (owner_user_id)` on `channels` and treat the user's channel as their profile. Author resolution (AZ-24) becomes a single `channels.owner_user_id = <user_id>` lookup.
- *Alternative considered:* a `profiles` table 1:1 with `auth.users`. Rejected — redundant with channel fields, no current field that belongs to the user but not the channel.

### `handle` is the canonical @identifier; `slug` mirrors it
Add a `handle` column (the user-facing `@handle`). The existing route is `/[channelSlug]` and `slug` is wired throughout actions/hooks, so rather than rip out `slug`, **set `slug = handle` on creation and keep them in sync on edit**. `handle` is what the UI shows and validates; `slug` remains the route key. Both unique.
- *Alternative considered:* drop `slug`, route on `handle`. Rejected for this ticket — larger blast radius across `[channelSlug]` for no user-visible gain; can converge later.

### Handle format, normalization, and uniqueness enforced in the DB
`handle` stored lowercased; format `^[a-z0-9_]{3,30}$`; uniqueness via a unique index on `lower(handle)` (or `citext`). A small reserved list (`admin`, `studio`, `account`, `live`, `watch`, `api`, `auth`, `login`, `signup`, `verify`, `onboarding`, `settings`) is rejected at the action layer so it can carry a friendly message. A `checkHandleAvailabilityAction` powers live availability feedback; the unique constraint is the source of truth (handle the unique-violation as an expected `ActionResult` error on submit).

### Onboarding is a guarded route, not middleware
New route `app/onboarding/page.tsx`. A `useRequireChannel` hook (react-query) loads the current user's channel; if the user is authenticated but has no channel, redirect to `/onboarding`; if they have one, `/onboarding` redirects away. Channel creation happens **on onboarding completion** (not at signup), since signup is followed by email verification. The owner already has a seeded channel, so they skip onboarding naturally.
- *Alternative considered:* auto-create an empty channel at first sign-in with a generated handle. Rejected — the ticket requires the user to pick the handle.

### Platform-owner check tightened to the seeded channel's owner
Define the platform owner as `owner_user_id` of the **earliest-created channel** (the seed). Replace `useIsOwner`'s `isAuthenticated` with a comparison of the current user id against the owner channel's `owner_user_id` (owner channel already fetched via `useOwnerChannel`). Publishing UI (`useRequireOwner`, studio) and the public `[channelSlug]` page use this: a non-owner channel page is `notFound()` for visitors other than its owner, keeping public viewing owner-only while still letting a user manage their own channel.

### Channel-management actions/hooks
New `getMyChannelAction` (current user's channel), `updateChannelAction` (name, handle→slug, description; owner-of-that-channel check + uniqueness), `createChannelAction` (onboarding), `checkHandleAvailabilityAction`. Hooks in `app/layout.hooks.tsx` (shared identity) and management UI hooks co-located with `account`/`studio/settings`. Reuse `BrandingUploadDialog` for images. All write actions return `ActionResult<T>`; mutation hooks unwrap per CLAUDE.md.

## Risks / Trade-offs

- **`slug`/`handle` drift** → keep them in sync in a single `updateChannelAction` path; never edit `slug` independently in the UI.
- **Existing seeded channel may have a `slug` that isn't a valid handle** → backfill `handle` from `slug` in the migration, normalizing to the allowed charset; if the seed slug already conforms this is a no-op.
- **`useIsOwner` change is load-bearing** (gates studio/publishing) → it now depends on the owner channel query resolving; while loading, treat as not-owner to avoid flashing owner-only UI to non-owners, and cover with the owner-gating scenarios.
- **Unique-violation race on handle** (two users submit same handle) → DB unique index is authoritative; the availability check is advisory; the submit action maps the unique violation to a friendly `ActionResult` error.
- **One-channel-per-user constraint vs. the seed/test fixtures** that insert multiple channels for one owner (`tests/e2e/*`) → fixtures use distinct owner ids or are updated; note for the tasks phase.

## Migration Plan

1. `npx supabase migration new add_channel_handle` — add `handle` column, backfill from `slug` (normalized), add `unique (owner_user_id)`, add unique index on `lower(handle)`, add format check constraint. Keep existing RLS (rows public-read, owner-only write).
2. `npx supabase db push`, then regenerate `supabase/types.ts`.
3. Ship actions/hooks, onboarding route + guard, management UI, and the owner-check tightening together.
4. **Rollback:** drop the `handle` column, the `unique (owner_user_id)` constraint, and the format/uniqueness indexes; revert `useIsOwner`. No destructive data change to existing columns.

## Open Questions

- Should the owner be configurable via env (e.g. `ADMIN_EMAIL`'s user id) rather than inferred as the earliest channel? Inferred-earliest is used here; revisit if seeding order ever changes.
- Final reserved-handle list — current list is a reasonable default; expand during implementation if new top-level routes are added.
