## Why

Someone who chats for the first time is onboarded into a channel and a membership and starts with
nothing. Their first reward arrives only once their chat has been scored, so the moment of joining itself
carries no value at all.

With `!tts` priced at one credit, a grant on joining is the difference between a new chatter being able to
take part immediately and having to wait for a scoring pass before anything they do can cost anything.

## What Changes

- A new membership is granted five credits at the moment it is created.
- Five because `!tts` costs one: an arriving chatter can be heard five times before earning anything, and
  a chatter earning at the usual rate of about three credits a broadcast re-earns three uses per stream.
  It also sits just below the median balance of nine among members who hold any, so arriving does not
  outrank months of attendance.
- The grant is written through the existing credit ledger rather than by adjusting a balance, so
  `scripts/verify-credit-ledger.ts` still balances.
- Granted exactly once per membership, and never on a rebuild. `scripts/recompute-memberships.ts` and the
  post-broadcast pass both rewrite membership rows, and neither may re-grant.
- Not granted to the host, who owns the community rather than belonging to it, and not to software
  accounts.

## Capabilities

### Modified Capabilities

- `credit-ledger`: a membership is granted a fixed number of credits when it is created, once and never
  again.

## Impact

- A trigger on `memberships` insert, and a partial unique index on the ledger keyed to the grant.
- No worker change at all. `recompute_membership` already inserts the membership with
  `on conflict do nothing` and never deletes one, so an insert trigger fires exactly once per membership
  by construction and a rebuild, which only updates, cannot fire it again.
- **Not in this change:** a grant for anything other than joining, any streak or milestone award, and any
  owner-facing control over the amount.
