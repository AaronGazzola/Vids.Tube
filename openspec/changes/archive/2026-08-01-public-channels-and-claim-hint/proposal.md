# Public channels + "Your channel" nav + channel claim hint

## Why

The identity model (AZ-169/AZ-170) makes channels the universal profile, but today only the platform owner's channel is publicly viewable and there is no way for a signed-in user to reach their own channel. To realize "channels as profiles", every account channel (and every unclaimed YouTube channel) should be public, the signed-in user needs a one-click path to their own channel, and their own channel should promote claiming their YouTube history the same way the live-chat banner does.

## What Changes

- **All channels publicly viewable** — the platform-owner viewing gate is relaxed so any account channel renders its normal channel/profile view to anyone (anon + signed-in). Publishing (live/VOD) stays gated to the platform owner. Unclaimed YouTube channels are already public (AZ-170).
- **"Your channel" sidebar nav** — a single top-of-nav entry for signed-in users linking to their own account channel (`/{account-handle}`). There is one nav target: the vids.tube account channel (which becomes the combined identity after verification).
- **Channel claim hint** — on a signed-in user's own channel, while their YouTube link is unverified, show a code hint (the same code-first verify code as the live-chat banner) prompting them to post it in the stream chat to claim their YouTube profile. Hidden once verified.

## Capabilities

### New Capabilities

- `channel-claim-hint`: the verify-code hint shown to the owner on their own unverified channel.

### Modified Capabilities

- `channels`: channel viewing is public for all channels (account + unclaimed); only publishing stays platform-owner gated.
- `app-shell`: the sidebar gains a "Your channel" entry for signed-in users.

## Impact

- **No migration.** Channel rows are already publicly readable (RLS `using (true)`); the gate is client-side.
- **UI**: `components/app-sidebar.tsx` (dynamic channel nav row via `useMyChannel`); `components/channel-view.tsx` (relaxed `canView`, mount the claim hint for the owner); new `components/channel-claim-hint.tsx` reusing `useEnsureVerifyCode` / `useRegenerateYoutubeCode`.
- **Depends on** the AZ-168 code-first flow (already implemented) and AZ-170 (unclaimed profiles).
