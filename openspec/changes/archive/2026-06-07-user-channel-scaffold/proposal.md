## Why

Today there is no per-user identity: every user maps to at most the single seeded owner channel, comments and chat render `userId.slice(0, 8)` instead of a name, and there is no way for a user to claim a handle or manage their own channel. This scaffold establishes a one-channel-per-user identity model with a `@handle`, which unblocks @handle display in comments/chat, chat moderation, follow/subscribe, and the future multi-channel explore — while keeping publishing and public channel viewing hard-gated to the owner for now.

## What Changes

- Add a unique, validated `@handle` to the per-user channel and enforce **one channel per user** at the data layer.
- Add a post-signup **onboarding step** where a new user picks a unique `@handle`; their channel is created on completion.
- Build **channel management UI** (channel name, handle, description, avatar, banner) wired to real persistence, replacing the stubbed "Coming soon" Settings and Account screens. Reuse the existing `BrandingUploadDialog` for avatar/banner.
- Keep **publishing (live/VOD) and public channel viewing hard-gated to the owner account** via RLS + react-query checks (no middleware). Non-owner users get an identity + manageable channel record, but cannot publish and their channel page is not publicly browsable.
- Resolve a user's handle/name/avatar from their channel (1:1), providing the lookup that AZ-24 (@handle in comments/chat) will consume.

## Capabilities

### New Capabilities
- `channel-onboarding`: post-signup flow that requires an authenticated user without a channel to pick a unique, format-validated `@handle`, then provisions their channel; gates app entry until completed.
- `channel-management`: owner-gated UI + actions to edit channel name, handle, description, avatar, and banner with validation and uniqueness enforcement.

### Modified Capabilities
- `channels`: add a unique `@handle` and a one-channel-per-user constraint to the data model; clarify that channel rows remain readable (for identity resolution) while publishing and public channel-page viewing are gated to the owner.

## Impact

- **DB / migrations:** new migration adding `handle` (unique, validated) to `channels`, a `unique (owner_user_id)` constraint, and a handle-format check; regenerate `supabase/types.ts`. RLS policies reviewed (rows stay publicly readable; mutation stays owner-only).
- **Auth / onboarding:** `app/(auth)/*` and `app/auth/callback` flow gains a handle-selection step; a new onboarding route/guard hook in `app/layout.hooks.tsx`.
- **Channel management:** `app/account/page.tsx` and `app/studio/settings/page.tsx` move from stubs to real forms; new actions/hooks for reading and updating the current user's channel + handle availability check.
- **Shared types:** `app/layout.types.ts` `Channel` type gains `handle`; new input types for onboarding/management.
- **Existing code:** `getOwnerChannelAction`, `[channelSlug]` page gating, and `BrandingUploadDialog` reuse. No change to comment/chat rendering in this ticket (that is AZ-24), only the lookup it depends on.
