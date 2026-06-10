## MODIFIED Requirements

### Requirement: Public read of VOD comments

The system SHALL allow any visitor (anonymous or authenticated) to read all
comments and their derived scores for any `ready` VOD. Each comment's author
SHALL be presented as the author's channel identity — the channel `@handle`,
display name, and avatar resolved from the channel whose `owner_user_id` equals
the comment's author `user_id` — and SHALL link to that author's channel page.
The system SHALL NOT render a raw or truncated user id as the author.

#### Scenario: Anonymous viewer reads comments

- **WHEN** an anonymous viewer opens `/watch/<videoId>` for a `ready` VOD that
  has comments
- **THEN** the page renders every comment with its author's channel handle, name,
  and avatar (linked to the author's channel page), its body, its created/edited
  timestamps, and its score (sum of votes)

#### Scenario: Author has no resolvable channel

- **WHEN** a comment's author `user_id` has no matching channel row
- **THEN** the comment renders with a neutral placeholder identity (no raw user
  id, no error) and the page still renders all other comments normally

#### Scenario: VOD has no comments

- **WHEN** a viewer opens a `ready` VOD that has no comments
- **THEN** the page renders an empty-state placeholder rather than an error
