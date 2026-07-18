## Context

The account page (app/(app)/account/page.tsx) is card-based with owner-checked
server actions. Live YouTube chat messages carry authorChannelId, so proving
control of a claimed channel only needs a nonce posted from it in the owner's
chat while the worker is engaged. OAuth stays deferred.

## Decisions

- Storage writes only via authenticated server actions using supabaseAdmin
  (RLS: select own row, no client writes) so verified_at is server-controlled.
- Codes: 6 chars from A-Z2-9 (no 0/O/1/I), regenerated on handle change or on
  demand; matcher requires exact trimmed-body equality AND author channel id
  equality with the claimed channel.
- The matcher runs in the scoring loop before commands on the same batch;
  verification messages are not swallowed (they are ordinary chat).
- fetchChannelByHandle uses channels.list?forHandle with the API key; canonical
  handle from snippet.customUrl when present.

## Risks / Trade-offs

- Verification needs a live/waiting stream with the worker engaged; the card
  copy says to post the code during a stream.
- A viewer could paste someone else's code, but only the claimed channel
  posting it verifies, so the worst case is nothing happening.
