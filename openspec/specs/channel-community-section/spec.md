# channel-community-section Specification

## Purpose
TBD - created by archiving change membership-loop. Update Purpose after archive.
## Requirements
### Requirement: A channel that has hosted shows its community

A channel page SHALL show a community section when that channel has hosted at least one broadcast. The section SHALL sit below the live-or-upcoming card and above the videos.

A channel that has never hosted SHALL NOT show the section at all, because a community with no broadcasts has no members.

The section SHALL show the community's member total, and a leaderboard of its top members by lifetime XP, each entry carrying avatar, name, level, XP and badges, and linking to that member's channel page anchored to this community.

The leaderboard SHALL open showing its first few members, with a control that expands it in place to reveal the rest a page at a time. Expansion SHALL happen on the same page; no separate members route SHALL be introduced. Once every member has been revealed, the control SHALL no longer render.

#### Scenario: The host channel shows its members

- **WHEN** a visitor opens the channel page of a channel that has hosted broadcasts
- **THEN** the community section renders below the live-or-upcoming card with the member total and the leaderboard

#### Scenario: A chatter's own channel has no community section

- **WHEN** a visitor opens the channel page of someone who has only ever chatted
- **THEN** no community section renders

#### Scenario: Leaderboard entries link to their members

- **WHEN** a visitor clicks a leaderboard entry
- **THEN** they arrive at that member's channel page with this community's membership highlighted

#### Scenario: The leaderboard expands a page at a time

- **WHEN** a visitor uses the expand control on a community of 143 members
- **THEN** a further page of members is appended in place, and the control remains until every member is shown

#### Scenario: The control disappears at the end

- **WHEN** every member of the community has been revealed
- **THEN** the expand control no longer renders

### Requirement: The community section is scoped by tabs

The community section SHALL offer tabs selecting which standing is shown: all time, the latest finished broadcast, and the broadcast currently in progress.

- All time SHALL rank members by lifetime XP and SHALL always be offered.
- Latest stream SHALL rank by what was earned in the most recently finished broadcast, and SHALL be offered only when a finished broadcast exists.
- Now live SHALL rank by what has been earned so far in the broadcast in progress, and SHALL be offered only while the channel is broadcasting.

Each board SHALL page a few at a time in place, as the all-time board already does, and every entry SHALL link to that member's channel page anchored to this community.

The separate "chatting now" list SHALL be removed: the live board shows the same people, ordered by what they have earned rather than merely listed.

#### Scenario: A finished broadcast has its own board

- **WHEN** a visitor selects the latest-stream tab
- **THEN** the members are those who took part in the most recently finished broadcast, ranked by what they earned in it

#### Scenario: The live tab is absent when not broadcasting

- **WHEN** the channel is not broadcasting
- **THEN** no now-live tab is offered, and the all-time board is shown

#### Scenario: The latest-stream tab is absent before any broadcast has finished

- **WHEN** the channel has never finished a broadcast
- **THEN** no latest-stream tab is offered

#### Scenario: Someone who chatted without scoring still appears

- **WHEN** a member sent messages in a broadcast but earned no XP in it
- **THEN** they appear on that broadcast's board below those who scored, rather than being absent

### Requirement: The live tab is distinguished and selected by default

While the channel is broadcasting, the now-live tab SHALL be visually distinct from the others, carrying a red indicator dot and a red outline, and SHALL be selected by default when the section first renders.

Once the reader has chosen a tab themselves, going live SHALL NOT move them off it.

A tab that stops being available SHALL NOT leave the section empty; the all-time board SHALL be shown instead.

#### Scenario: Going live opens on the live board

- **WHEN** a visitor opens the channel page while a broadcast is in progress
- **THEN** the now-live tab is selected and its board is shown

#### Scenario: The live tab is marked as live

- **WHEN** the now-live tab renders
- **THEN** it carries a red dot and a red outline, distinguishing it from the other tabs

#### Scenario: A reader's own choice is respected

- **WHEN** a visitor selects the all-time tab and the channel then goes live
- **THEN** the all-time board stays selected

#### Scenario: A broadcast ending does not strand the reader

- **WHEN** the broadcast ends while the now-live board is selected
- **THEN** the all-time board is shown instead of an empty section

### Requirement: The community excludes software and account-only members

The member total, the leaderboard, and the current-broadcast list SHALL all apply the member-count definition, so channels marked as software and memberships whose channel carries no YouTube identity are absent from every one of them.

#### Scenario: The bot is not on the leaderboard

- **WHEN** the leaderboard is rendered for a community whose chat includes the delivery bot
- **THEN** the bot does not appear, regardless of its message count

