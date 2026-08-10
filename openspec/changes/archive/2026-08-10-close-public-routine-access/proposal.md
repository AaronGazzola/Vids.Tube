## Why

Nine `SECURITY DEFINER` routines are callable by a signed-out visitor over the
public API. This was read from the database rather than inferred: each of the
nine carries a bare `=X` entry in its access list, which is the grant Postgres
gives `PUBLIC` on every new function. PostgREST exposes anything `anon` can call
at `/rest/v1/rpc/<name>`, and a `SECURITY DEFINER` routine bypasses row-level
security by design, so each of the nine is an unauthenticated write path into
the economy or into identity.

Two of them move credits directly (`spend_credits`, `write_earned_credits`),
three recompute balances and stats, one merges a YouTube identity into a
channel, and three are trigger functions that were never meant to be an API.

The precedent is the recording swap, revoked 10-Aug-2026. It shipped with
`revoke execute … from anon, authenticated` and a comment saying no signed-in
user has any business reaching it. The intent was right and the statement did
nothing, because neither role held the grant directly — both inherited it from
`PUBLIC`. Revoking `PUBLIC` cleared it. This change applies that same correction
to the remaining nine.

The reason this is a change rather than a nine-line migration is that a blind
sweep breaks chat. `is_participant_banned` is not called from the browser, but it
is called *inside* a restrictive insert policy on `chat_messages`, and a policy
expression is evaluated as the querying role. Revoking `EXECUTE` from
`authenticated` would deny every signed-in chat message with a permission error.
So the routine that looks most obviously safe to sweep is the one that must keep
a grant, and it has to keep it explicitly rather than by inheritance.

## What Changes

- The `PUBLIC` grant is revoked from all nine routines, alongside `anon` and
  `authenticated` by name so the intent survives a later re-grant of `PUBLIC`.
- `is_participant_banned` is then granted to `authenticated` explicitly, because
  the restrictive insert policy on chat messages calls it and would otherwise
  deny every signed-in post. `anon` does not need it: the policy names
  `authenticated` only.
- The three trigger functions lose every grant. Firing a trigger does not check
  `EXECUTE`, so the triggers on user signup, membership credit sync and duplicate
  community identity keep working with no grant at all.
- A check that fails when a `SECURITY DEFINER` routine in the public schema
  carries the `PUBLIC` grant, so the next one cannot ship open. The gap between
  what a revoke statement says and what it does is what let this survive review
  once already, and a comment cannot catch that a second time.

## Capabilities

### New Capabilities
- `database-routine-access`: which database routines are reachable by a
  signed-out visitor and by a signed-in user, and the check that keeps a new
  routine from shipping publicly callable.

### Modified Capabilities

## Impact

- Callers are unaffected. Every caller of the nine is the service role: the
  worker, the one-off scripts, and the verification scripts. No browser code
  calls any of them, confirmed by reading each name against the application code
  rather than assuming.
- Chat posting by signed-in users is the one behaviour at risk, and the explicit
  grant is what protects it. It is proven rather than reasoned about.
- Six routines that are not `SECURITY DEFINER` keep their public grant and are
  out of scope. Those run as the caller and stay subject to row-level security,
  and two of them serve the channel page.
- AZ-243 is the tracking issue.
