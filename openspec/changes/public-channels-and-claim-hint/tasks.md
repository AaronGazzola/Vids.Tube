## 1. Public channel viewing

- [x] 1.1 In `components/channel-view.tsx`, relax `canView` so any existing channel renders: unclaimed (ownerless, non-tombstone) → the stats profile branch; any owned channel → the normal channel/profile view; tombstones redirect (unchanged). Remove the now-unused `isPlatformOwnerChannel` gate. Keep branding-upload affordances gated on `isOwner`.
- [x] 1.2 Verify anon viewing of a non-owner channel does not error on the videos query (`getChannelVideosAction`); regular channels simply render an empty Videos section.

## 2. "Your channel" sidebar entry

- [x] 2.1 In `components/app-sidebar.tsx`, render a dynamic "Your channel" nav row (via `useMyChannel`) at the top of the nav for signed-in users, linking to `/{myChannel.slug}` with a channel icon; reuse the existing `NavRow` (collapsed + expanded). Hidden for anonymous visitors and while the channel query is pending.

## 3. Channel claim hint

- [x] 3.1 Create `components/channel-claim-hint.tsx` reusing `useEnsureVerifyCode` + `useRegenerateYoutubeCode`: a card showing the verify code, a copy button, a "New code" control, and an instruction to post it in the stream's YouTube chat to claim their YouTube profile. Render nothing once verified.
- [x] 3.2 Mount the hint in `components/channel-view.tsx`'s normal channel view only when `isOwner` (the signed-in owner viewing their own channel), near the top below the header.

## 4. Verify

- [x] 4.1 `npm run build:local` passes (type-check clean).
