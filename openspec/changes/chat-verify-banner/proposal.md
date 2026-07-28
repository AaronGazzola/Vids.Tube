# In-chat YouTube verify banner (AZ-168)

## Why

The `youtube_links` verification flow exists end-to-end (account card generates a code; the worker matches it in YouTube chat) but currently has **0 verified links** because it is buried on the Account page. Verification is the bridge that pools a chatter's YouTube history into their Vids.Tube identity (and, once AZ-169 ships, triggers the identity merge), so surfacing it where users already are — the live chat panel — is the highest-leverage nudge.

## What Changes

- **Verify banner at the top of the Vids.Tube live chat panel** — shown only to signed-in users whose `youtube_links` row is missing or has `verified_at IS NULL`; hidden entirely once verified.
- **Two banner states**: (1) has a link but unverified → show the 6-character `verify_code` with a copy button and the instruction to paste it into the YouTube live chat; (2) no link yet → an inline `@handle` entry (reusing `saveYoutubeLinkAction`) to start the claim, or a deep link to the Account card.
- **Per-session dismissible** — a dismissed banner stays hidden for the session and reappears on the next visit until the link is verified.
- **Realtime-aware** — the banner reflects a verification that lands mid-session (worker sets `verified_at`) and disappears without a manual refresh.

## Capabilities

### New Capabilities

- `chat-verify-banner`: the in-chat banner surface — visibility rules, the two states, copy/dismiss behavior, and reactive hiding on verification.

### Modified Capabilities

- `youtube-handle-link`: verification becomes **code-first** — the code alone identifies the account and the YouTube channel/handle are learned from whoever posts the code (no handle typed up front). `youtube_links` channel id/handle become nullable and the verify code becomes unique.

## Impact

- **Migration**: `youtube_links.youtube_channel_id` / `youtube_handle` become nullable; unique index on `verify_code`.
- **Actions**: new `ensureVerifyCodeAction` (get-or-create a code for the signed-in user, no handle); `YoutubeLink` type channel/handle nullable; save/regenerate use a collision-checked unique code.
- **Worker**: `worker/lib/verify-links.ts` matches an outstanding code regardless of channel, then sets channel id/handle from the message author, verifies, and triggers the AZ-169 merge.
- **UI**: banner mounted in `components/live-chat.tsx` showing only the code (no handle input); collapses to a thin re-expandable bar; hidden entirely once verified. Session-scoped collapse store.
- **Account page**: `YoutubeLinkCard` guards a null handle (code-first rows show a pending state).
