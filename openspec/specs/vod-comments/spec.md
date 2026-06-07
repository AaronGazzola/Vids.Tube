# vod-comments Specification

## Purpose
TBD - created by archiving change add-vod-ux-improvements. Update Purpose after archive.
## Requirements
### Requirement: Public read of VOD comments

The system SHALL allow any visitor (anonymous or authenticated) to read all
comments and their derived scores for any `ready` VOD.

#### Scenario: Anonymous viewer reads comments

- **WHEN** an anonymous viewer opens `/watch/<videoId>` for a `ready` VOD that
  has comments
- **THEN** the page renders every comment, its author display name, its body,
  its created/edited timestamps, and its score (sum of votes)

#### Scenario: VOD has no comments

- **WHEN** a viewer opens a `ready` VOD that has no comments
- **THEN** the page renders an empty-state placeholder rather than an error

### Requirement: Authenticated comment posting

The system SHALL allow an authenticated user to post a comment on any `ready`
VOD, attributed to their own user id.

#### Scenario: Signed-in user posts a comment

- **WHEN** a signed-in user submits a non-empty comment body on a `ready` VOD
- **THEN** a `comments` row is inserted with the user's id, the video's id,
  the body, and a server-set `created_at`, and the comment appears in the
  list on the next refetch

#### Scenario: Anonymous user attempts to post

- **WHEN** an anonymous visitor attempts to submit a comment
- **THEN** the UI prompts them to sign in and no row is written

#### Scenario: Empty or whitespace-only body

- **WHEN** a user submits a comment whose body is empty or whitespace-only
- **THEN** the action rejects the submission and no row is written

### Requirement: Owner-only edit and delete

The system SHALL allow a user to edit or delete only the comments they
authored, and SHALL prevent any user from editing or deleting another user's
comments.

#### Scenario: Author edits own comment

- **WHEN** the comment's author submits an edited body
- **THEN** the row's `body` is updated and `edited_at` is set to the current
  server time

#### Scenario: Author deletes own comment

- **WHEN** the comment's author triggers delete
- **THEN** the row is removed and its associated `comment_votes` rows are
  removed by cascade

#### Scenario: Non-author attempts to edit

- **WHEN** any user other than the comment's author attempts to edit it
- **THEN** row-level security rejects the update and the row is unchanged

#### Scenario: Non-author attempts to delete

- **WHEN** any user other than the comment's author attempts to delete it
- **THEN** row-level security rejects the delete and the row is unchanged

### Requirement: Up/down voting with toggle

The system SHALL allow an authenticated user to cast at most one vote per
comment, valued `+1` or `-1`, and SHALL allow them to switch the vote or remove
it.

#### Scenario: First upvote

- **WHEN** a signed-in user upvotes a comment for the first time
- **THEN** a `comment_votes` row is inserted with `value = 1` keyed by
  `(comment_id, user_id)`

#### Scenario: Switching from up to down

- **WHEN** the same user then downvotes the same comment
- **THEN** the existing `comment_votes` row's `value` becomes `-1` (no second
  row is inserted)

#### Scenario: Removing a vote

- **WHEN** a user clicks the same vote direction twice (or explicitly removes
  their vote)
- **THEN** their `comment_votes` row is deleted

#### Scenario: Anonymous user attempts to vote

- **WHEN** an anonymous visitor attempts to vote on a comment
- **THEN** the UI prompts them to sign in and no `comment_votes` row is
  written

### Requirement: Comment score is the sum of votes

The system SHALL display each comment's score as the sum of its
`comment_votes.value`, computed by the server, with no client-side scoring.

#### Scenario: Score reflects the votes

- **WHEN** a comment has three upvotes and one downvote
- **THEN** the score shown is `2`

#### Scenario: Comment with no votes

- **WHEN** a comment has no `comment_votes` rows
- **THEN** the score shown is `0`

### Requirement: Newest-first ordering

The system SHALL order comments by `created_at` descending for v1, with no
client-selectable sort.

#### Scenario: Newest comments appear first

- **WHEN** a viewer opens a VOD with multiple comments
- **THEN** the most recently created comment is rendered first, with older
  comments following in descending order

