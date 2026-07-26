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

_None — this reuses the existing `youtube-handle-link` actions and worker verification unchanged._

## Impact

- **No migration, no schema change** — reads `youtube_links` via the existing `getYoutubeLinkAction`; writes via existing `saveYoutubeLinkAction` / `regenerateYoutubeCodeAction`.
- **UI**: new banner component mounted at the top of `components/live-chat.tsx`; a small hook for the signed-in user's link state + a session-scoped dismiss store.
- **Independent of AZ-169/AZ-170**: works today against the current verify flow; when AZ-169 ships, the same verification it drives will additionally trigger the identity merge (no change needed here).
- **Mirrors** the existing `YoutubeLinkCard` behavior in `app/(app)/account/page.tsx`.
