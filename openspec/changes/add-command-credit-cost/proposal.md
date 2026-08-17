## Why

Credits are earned and never spent. Every one of the 147 ledger entries in production is an earning, and
the balance appears in two places: the `!me` reply and the returning-chatter greeting. Nothing costs
anything, so a credit means nothing.

The roadmap records `credit_cost` on the command registry and `!tts` as the first sink as shipped. Neither
exists. There is no such column, and no code anywhere refers to one. The roadmap is wrong on this point
and is corrected by this change rather than by editing the claim.

The ledger itself is ready: `spend_credits` already exists, already refuses a spend the balance cannot
cover, and the `credit-ledger` capability already specifies both. What is missing is anything that calls
it.

## What Changes

- A command in the registry carries a credit cost. Zero, the default, means free, which is what every
  command is today.
- `!tts` costs 1 credit. That is the settled price: a new member's joining grant is five credits, so an
  arriving chatter can have their message spoken five times before they have earned anything, and a
  chatter earning at the usual rate of about three credits a stream re-earns three uses a broadcast.
- A priced command charges the chatter before it executes, writing the spend through the existing ledger
  function so the ledger still balances and a re-score still cannot refund or confiscate it.
- A chatter who cannot afford it is told the price and their balance, and the command does not run.
- The host is never charged. The host owns the community rather than belonging to it, and holds no
  membership to charge.
- The price is data, like every other limit in the registry: the owner changes it without a deploy.

## Capabilities

### Modified Capabilities

- `chat-commands`: a registry row carries a credit cost, and a priced command charges the chatter's
  membership before executing.
- `tts-requests`: `!tts` costs one credit.

## Impact

- `chat_commands` gains `credit_cost`; `command_events.status` admits `insufficient`.
- `worker/lib/commands.ts` charges between the per-stream limit check and execution.
- **Not in this change:** refunding a command that failed after being charged, pricing any command other
  than `!tts`, an owner-facing editor for the price beyond what the registry already exposes, and any
  change to how credits are earned.
