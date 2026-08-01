## Context

- Every signed-in user has an account channel (`owner_user_id` = them). Unclaimed YouTube channels (AZ-170) are ownerless, stats-only, and already public. Merged channels tombstone and redirect (AZ-169).
- `components/channel-view.tsx` gates rendering with `canView = isPlatformOwnerChannel || isOwner`; unclaimed channels render a separate branch (AZ-170). Channel rows are publicly readable via RLS (`using (true)`), so the gate is purely client-side.
- The code-first verify flow (AZ-168) exposes `useEnsureVerifyCode` / `useRegenerateYoutubeCode` and a shared verify code per signed-in user.

## Goals / Non-Goals

**Goals:**

- Public viewing for all channels (account + unclaimed); publishing stays platform-owner gated.
- One sidebar nav entry to the signed-in user's own account channel.
- A code hint on the owner's own unverified channel promoting the claim.

**Non-Goals:**

- Profile-vs-channel empty-state polish for account channels with no videos/streams (follow-up).
- Any change to the verify/merge mechanics or a migration.

## Decisions

- **D1 — Relax the viewing gate, keep publishing gated.** `canView` becomes "the channel exists"; claimed channels (any owner) render the normal view to anyone, unclaimed render the stats profile, tombstones redirect. Publishing/upload affordances stay gated on `isOwner`. This supersedes AZ-170's partial relaxation of the same requirement (which only opened unclaimed channels).
- **D2 — Dynamic nav row, single target.** The "Your channel" entry is rendered from `useMyChannel` (not the static `NAV_ITEMS`) linking to `/{myChannel.slug}`, signed-in only. After verification the account channel is the combined identity, so the nav target never changes.
- **D3 — Claim hint reuses the code-first flow.** `components/channel-claim-hint.tsx` uses `useEnsureVerifyCode` + `useRegenerateYoutubeCode`, mounted in the normal channel view only when `isOwner`. It renders nothing once the link is verified. Same code the live-chat banner shows.

## Risks / Trade-offs

- [Account channels with no videos render an empty Videos section] → acceptable for now; a profile-style empty state is a follow-up, not a blocker for public visibility.
- [Two active changes modify the same `channels` viewing requirement] → this change carries the authoritative final (fully public) version; reconcile at archive by archiving this after AZ-170 or merging the deltas.
