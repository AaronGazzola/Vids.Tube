## MODIFIED Requirements

### Requirement: Public stats-only profile

An unclaimed channel SHALL be publicly viewable by anyone as a profile carrying: name, `@handle`, avatar/banner, and the memberships that channel holds, rendered by the same memberships section that a claimed channel uses. It SHALL NOT render videos, live content, description, or an AI bio. Merged (tombstone) channels SHALL NOT render this profile and SHALL continue to redirect to their survivor.

The previous behaviour — a bare strip of four numbers scoped to a single hard-coded community, replacing the whole page — SHALL be removed. An unclaimed profile is the page a greeted chatter lands on, and 144 of 148 members are unclaimed, so it is the common case rather than a degraded one.

#### Scenario: Anonymous visitor views an unclaimed profile

- **WHEN** an anonymous visitor opens an unclaimed channel's page
- **THEN** the profile renders with the memberships section, and no video/live sections appear

#### Scenario: The unclaimed profile is not a reduced page

- **WHEN** an unclaimed channel holds a membership
- **THEN** that membership renders as a full membership card with level, rank, XP, messages, broadcasts attended, streak and badges

#### Scenario: Merged channel still redirects

- **WHEN** a visitor opens a channel whose `merged_into_channel_id` is set
- **THEN** they are redirected to the surviving channel rather than shown the unclaimed profile

### Requirement: Claim this profile flow

The "Claim this profile" control SHALL route an unauthenticated visitor to sign-in and an authenticated visitor to the account YouTube-link card (deep-linked), where the existing verify-code flow completes the claim and triggers the AZ-169 identity merge. The system SHALL NOT provide a `!link` chat command.

The control SHALL render only when the channel being viewed is itself unclaimed, and only for an anonymous visitor or a signed-in user whose YouTube link is not verified. A claimed channel SHALL never show the control, whatever the viewer's state, because a claimed channel is not available to be claimed by anyone.

The wording SHALL NOT assert that the page belongs to the person reading it. Anyone may follow the link and see the same page, so the control SHALL ask whether the profile is theirs rather than telling them it is.

The control SHALL be unobtrusive but apparent: plainly visible without displacing the profile's own content. The present bordered panel is a placeholder and SHALL be reworked to this treatment.

#### Scenario: Signed-in user starts a claim

- **WHEN** a signed-in user clicks "Claim this profile" on an unclaimed channel
- **THEN** they are taken to the YouTube-link card to enter their handle and receive a verify code

#### Scenario: Anonymous visitor is offered the claim

- **WHEN** an anonymous visitor opens an unclaimed channel's page
- **THEN** the claim control renders and leads to sign-in

#### Scenario: An already-linked user is not offered the claim

- **WHEN** a signed-in user whose YouTube link is verified opens an unclaimed channel's page
- **THEN** no claim control renders

#### Scenario: A claimed channel never offers the claim

- **WHEN** an anonymous visitor, or a signed-in user with no verified link, opens a channel that already has an owner
- **THEN** no claim control renders

#### Scenario: The wording does not presume the reader

- **WHEN** the claim control renders to any visitor
- **THEN** its wording asks whether the profile belongs to them, and does not state that the page is theirs
