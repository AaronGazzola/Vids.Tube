## MODIFIED Requirements

### Requirement: Contextual claim prompt for unclaimed identities

When `!me` resolves to an identity that is not yet claimed (a YouTube identity whose channel has no owner, or a user with no verified YouTube link), the reply SHALL append a short claim prompt pointing to the identity's channel URL. The prompt SHALL be suppressed once the identity is claimed. No `!link` command SHALL be introduced.

The URL SHALL be written with the `https://` scheme and SHALL carry the anchor identifying the broadcast's community, so it is rendered as a clickable link by YouTube live chat and lands on the caller's membership for the community they are chatting in. The previous bare-text form, which named the handle without a scheme and was therefore not clickable, SHALL be removed.

#### Scenario: Unclaimed chatter is nudged

- **WHEN** an unclaimed YouTube identity runs `!me`
- **THEN** the reply includes a claim prompt referencing their channel handle URL

#### Scenario: The prompt is clickable

- **WHEN** the claim prompt is delivered to YouTube live chat
- **THEN** its URL begins with `https://` and is rendered as a link

#### Scenario: The prompt lands on this community's membership

- **WHEN** an unclaimed chatter runs `!me` during a broadcast
- **THEN** the link opens their channel page with that broadcast's community membership highlighted

#### Scenario: Claimed identity gets no prompt

- **WHEN** a claimed identity runs `!me`
- **THEN** the reply contains no claim prompt
