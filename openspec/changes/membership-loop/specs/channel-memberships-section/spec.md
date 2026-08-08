## ADDED Requirements

### Requirement: Every channel page lists the memberships that channel holds

A channel page SHALL show a memberships section listing every community that channel has chatted in, one card per membership. The section SHALL render for claimed and unclaimed channels alike, because almost every member is unclaimed.

Each card SHALL show the host community's avatar and name, a live marker when that community is broadcasting, the member's standing in that community (level, rank, lifetime XP, credits, messages, broadcasts attended, current streak, best streak), the badges awarded in that community, and a control leading to that community.

Each figure SHALL carry its own coloured icon, so the row is read by glancing rather than by working through every label. A figure of nothing SHALL lose its colour along with its emphasis, so an earned figure and an empty one never look alike.

The count of broadcasts SHALL be labelled "attended". Labelling it "broadcasts" on a card that sits beside a host community invites reading it as broadcasts the member ran, which is the opposite of what it counts.

Every card SHALL have the same shape regardless of standing. A member who has just joined SHALL see the same card as a long-standing member, carrying zeroes, and SHALL NOT be shown any additional or substitute content in its place.

A channel holding no memberships SHALL NOT render the section at all.

#### Scenario: A member sees their standing

- **WHEN** a visitor opens the channel page of someone who has chatted in a community
- **THEN** a card for that community shows the member's level, rank, XP, credits, messages, broadcasts attended, streaks and badges, and a control leading to that community

#### Scenario: An empty figure is not dressed up as an earned one

- **WHEN** a member has earned nothing against one of the figures
- **THEN** that figure's icon is drawn without its colour, matching the muted figure beside it

#### Scenario: Attendance is not mistaken for hosting

- **WHEN** the count of broadcasts a member took part in is shown
- **THEN** it is labelled "attended" rather than "broadcasts"

#### Scenario: A new member's card matches everyone else's

- **WHEN** a chatter who has just sent their first message opens their channel page
- **THEN** the card carries the same fields in the same arrangement as a long-standing member's card, showing zeroes where nothing has been earned

#### Scenario: An unclaimed channel still shows memberships

- **WHEN** a visitor opens an unclaimed chatter's channel page
- **THEN** the memberships section renders with that chatter's standing

#### Scenario: No memberships means no section

- **WHEN** a channel holds no memberships
- **THEN** the memberships section does not render, and no empty state or empty container is drawn

### Requirement: Rank is withheld until a member has earned XP

A membership card SHALL show "just joined" in place of a numeric rank while the member's lifetime XP is zero, and SHALL show the numeric rank once lifetime XP is above zero.

This exists because 113 of 148 members currently sit at zero XP and therefore tie: a true rank for a newcomer reads as a position near the bottom of a crowd of ties, which is accurate and discouraging, and says nothing a zero XP figure has not already said.

#### Scenario: A newcomer sees no number

- **WHEN** a member's lifetime XP is zero
- **THEN** the card shows "just joined" where the rank would be

#### Scenario: Earning XP reveals the rank

- **WHEN** a member's lifetime XP rises above zero
- **THEN** the card shows their numeric rank within the community

### Requirement: Live communities sort first

The memberships section SHALL order cards with communities that are currently broadcasting first, and the remainder after them in a stable order. This means a chatter arriving from a greeting during a broadcast finds the relevant card at the top.

#### Scenario: The live community is at the top

- **WHEN** one of a member's communities is broadcasting and two are not
- **THEN** the broadcasting community's card is first

### Requirement: A membership can be addressed and is highlighted on arrival

A membership card SHALL be addressable by an anchor identifying its community. When a channel page is opened at such an anchor, the named card SHALL be visually highlighted and the page SHALL scroll to it once the membership list has loaded.

Scrolling SHALL be triggered after the data resolves rather than relying on the browser's native anchor jump, because the list does not exist at first paint.

#### Scenario: Arriving from a greeting lands on the right card

- **WHEN** a chatter follows the link from their greeting
- **THEN** their channel page opens, the card for that broadcast's community is highlighted, and the page has scrolled to it

#### Scenario: The scroll waits for the data

- **WHEN** the page is opened at an anchor while the membership list is still loading
- **THEN** the scroll happens once the list has rendered, not before

#### Scenario: An unknown anchor is harmless

- **WHEN** the page is opened at an anchor naming a community the channel holds no membership in
- **THEN** the page renders normally with nothing highlighted and no scroll
