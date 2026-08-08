## ADDED Requirements

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

### Requirement: The live broadcast shows who is chatting

While the channel is broadcasting, the community section SHALL additionally show the members who have chatted in the current broadcast, each linking to their own channel page anchored to this community.

This is the shared route named on the overlay: a viewer who cannot or will not follow a link from chat can reach the address, find themselves in this list, and open their own page from it.

#### Scenario: Chatters appear during the broadcast

- **WHEN** a chatter sends their first message of a live broadcast
- **THEN** they appear in the current-broadcast list on the host's channel page

#### Scenario: The list is absent when not broadcasting

- **WHEN** the channel is not broadcasting
- **THEN** the current-broadcast list does not render, and the member total and leaderboard still do

### Requirement: The community excludes software and account-only members

The member total, the leaderboard, and the current-broadcast list SHALL all apply the member-count definition, so channels marked as software and memberships whose channel carries no YouTube identity are absent from every one of them.

#### Scenario: The bot is not on the leaderboard

- **WHEN** the leaderboard is rendered for a community whose chat includes the delivery bot
- **THEN** the bot does not appear, regardless of its message count
