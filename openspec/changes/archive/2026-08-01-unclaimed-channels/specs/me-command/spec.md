# me-command Specification (delta)

## ADDED Requirements

### Requirement: Contextual claim prompt for unclaimed identities

When `!me` resolves to an identity that is not yet claimed (a YouTube identity whose channel has no owner, or a user with no verified YouTube link), the reply SHALL append a short claim prompt pointing to the identity's channel URL. The prompt SHALL be suppressed once the identity is claimed. No `!link` command SHALL be introduced.

#### Scenario: Unclaimed chatter is nudged

- **WHEN** an unclaimed YouTube identity runs `!me`
- **THEN** the reply includes a claim prompt referencing their channel handle URL

#### Scenario: Claimed identity gets no prompt

- **WHEN** a claimed identity runs `!me`
- **THEN** the reply contains no claim prompt
