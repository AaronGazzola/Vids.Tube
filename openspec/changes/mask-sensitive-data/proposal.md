## Why

Development sessions are streamed and recorded, so anything printed into a
Claude session is published. On the 8-Aug-2026 broadcast an account email
reached the transcript and went out in the VOD, which is now the subject of
AZ-236 and AZ-239.

The obvious mitigation does not work here. Every committed script already uses
synthetic addresses, so masking inside the repository's own scripts would not
have prevented this leak: the value arrived from a query written during the
session, against production, and printed straight back. Ad-hoc code cannot be
made safe by editing code that already exists, because the offending code does
not exist until the moment it runs.

The safeguard therefore has to sit at the boundary where a tool result enters
the session, and it has to hold for code nobody has written yet.

## What Changes

- A masking rule set, held in one place, that recognises the categories worth
  hiding on stream: email addresses, bearer tokens and API keys, JSON Web
  Tokens, account identifiers, phone numbers, and postal addresses.
- A `PostToolUse` hook that rewrites a tool's result before the result reaches
  the session, so a sensitive value never enters the transcript at all rather
  than being redacted after the fact.
- Masked output that stays legible: an address is shown with its shape intact
  so two different accounts remain distinguishable, and the count of masked
  values is reported so nothing disappears silently.
- A deliberate reveal path, so a value that genuinely must be read can be read,
  by asking first rather than by disabling the safeguard.
- A written rule in the repository guidance, covering what the session itself
  writes rather than what tools return.
- The same safeguard in `../eco3d.shop`, delivered as its own change in that
  repository, since a change cannot span two repositories.

## Capabilities

### New Capabilities
- `sensitive-data-masking`: what counts as sensitive, how a masked value is
  presented, where masking is enforced, and how a value is deliberately
  revealed.

### Modified Capabilities

## Impact

- Adds the first `.claude/settings.json` to this repository, along with the hook
  it registers. No hook exists here today.
- Affects every tool result that can carry production data into a session:
  shell output, Supabase query results, and file reads.
- Costs one short process per tool result, so the matching must be cheap enough
  to be unnoticeable.
- Does not change any application behaviour, any database schema, or anything a
  viewer of the site can observe.
- AZ-235 is the tracking issue.
