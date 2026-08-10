# database-routine-access Specification

## Purpose
TBD - created by archiving change close-public-routine-access. Update Purpose after archive.
## Requirements
### Requirement: A privileged routine is not reachable by a signed-out visitor

No `SECURITY DEFINER` routine in the public schema SHALL carry the `PUBLIC`
grant. Revoking `anon` and `authenticated` by name SHALL NOT be treated as
sufficient, because neither role holds the grant directly: both inherit it from
`PUBLIC`, and revoking a role removes a grant it never held.

#### Scenario: The access list is the evidence

- **WHEN** the access list of a `SECURITY DEFINER` routine is read after this
  change
- **THEN** it holds only the owner and the service role, plus any grant this
  specification requires by name, and no bare `PUBLIC` entry

#### Scenario: The economy is closed to a signed-out caller

- **WHEN** a signed-out caller invokes the routine that spends credits, or the
  routine that writes earned credits, over the public API
- **THEN** the call is refused for lack of permission, and no credit row is
  written

#### Scenario: Identity merging is closed to a signed-out caller

- **WHEN** a signed-out caller invokes the identity merge routine over the public
  API
- **THEN** the call is refused for lack of permission, and no raw event is
  re-keyed

### Requirement: Revoking does not break the chat posting path

The routine that reports whether a participant is banned SHALL remain executable
by the `authenticated` role, granted explicitly rather than inherited from
`PUBLIC`. A restrictive insert policy on chat messages calls that routine, and a
policy expression is evaluated as the querying role, so removing the grant would
deny every signed-in chat message.

#### Scenario: A signed-in member posts after the revoke

- **WHEN** a signed-in member who is not banned posts a chat message
- **THEN** the message is inserted, and no permission error is raised by the
  policy

#### Scenario: A banned member still cannot post

- **WHEN** a signed-in member who is banned posts a chat message
- **THEN** the insert is denied by the policy, as it was before the revoke

#### Scenario: A signed-out caller gains nothing from the exception

- **WHEN** a signed-out caller invokes the ban-reporting routine over the public
  API
- **THEN** the call is refused for lack of permission

### Requirement: A trigger keeps firing without a grant

A routine invoked only as a trigger SHALL hold no grant at all. Firing a trigger
does not check `EXECUTE` on the trigger routine, so the grant serves nothing but
exposure.

#### Scenario: Signup, credit sync and duplicate identity triggers

- **WHEN** a user is created, a membership's earned credits are written, or a
  channel is given a community identity that already exists
- **THEN** the corresponding trigger fires and behaves exactly as before,
  despite the routine behind it holding no grant

### Requirement: A newly added privileged routine cannot ship publicly callable

A check SHALL exist that reads the access lists from the database and fails when
a `SECURITY DEFINER` routine in the public schema carries the `PUBLIC` grant. The
check SHALL name each offending routine. Any routine that is deliberately
callable SHALL be listed in the check as an exception, so the decision is
recorded where it is enforced rather than in a comment on a migration.

#### Scenario: A routine added without a revoke

- **WHEN** a `SECURITY DEFINER` routine is created without revoking `PUBLIC` and
  the check is run
- **THEN** the check fails and names that routine

#### Scenario: The database as it stands after this change

- **WHEN** the check is run against the current database
- **THEN** the check passes, with the ban-reporting routine's grant to
  `authenticated` recorded as its only exception

