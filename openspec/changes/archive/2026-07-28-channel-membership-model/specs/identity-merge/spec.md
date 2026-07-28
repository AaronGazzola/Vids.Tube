# identity-merge Specification (delta)

## ADDED Requirements

### Requirement: Merge runs on link verification

The system SHALL provide a `merge_youtube_identity(p_user_id)` SQL function, executable by the service role only, that pools a verified YouTube identity into the user's channel. The worker SHALL invoke it immediately after setting `youtube_links.verified_at`; a merge failure SHALL be logged with `console.error` and SHALL NOT block processing of the rest of the chat batch. The function SHALL require a verified link and SHALL return an expected error when the user has no channel.

#### Scenario: Verification triggers the merge

- **WHEN** the worker verifies a YouTube link for a user who owns a channel
- **THEN** `merge_youtube_identity` runs for that user in the same processing pass

#### Scenario: Unverified link does not merge

- **WHEN** `merge_youtube_identity` is called for a user whose link has `verified_at` null or no link row
- **THEN** the function returns an error and modifies nothing

### Requirement: Raw events are re-keyed, aggregates recomputed

The merge SHALL re-key the YouTube identity's raw events onto the surviving channel and recompute all aggregates from the pooled event stream; it SHALL never combine two aggregate values directly (the sole exceptions: the `credits` balances are summed and `rewards` arrays unioned, because they are not derivable). Re-keying SHALL set `user_id = p_user_id` on all `chat_messages`, `score_events`, and `featured_messages` rows where `origin = 'youtube'` and `external_author_id` equals the linked YouTube channel id, preserving `origin` and `external_author_id` as provenance, and SHALL rewrite `participant_key` from `'youtube:' || ycid` to `p_user_id::text` in `command_events`, `tts_requests`, `ask_requests`, and `clip_markers`.

#### Scenario: YouTube chat history joins the account

- **WHEN** a user with prior YouTube-origin chat messages verifies their link
- **THEN** those `chat_messages` rows carry the user's `user_id` while retaining `origin = 'youtube'` and the original `external_author_id`

#### Scenario: Aggregates are never added together

- **WHEN** both identities have score history in the same community
- **THEN** the surviving membership's `lifetime_xp`, streaks, counts, and timestamps equal a fresh recompute over the pooled raw events (with earliest `first_seen_at` winning by construction), not the sum or max of the two old membership rows

### Requirement: Per-stream score collision rebuild

For every stream where either identity has `viewer_scores` rows, the merge SHALL delete both identities' rows and insert one row per stream re-aggregated from the re-keyed raw events: `total_score` as the sum of `score_events.points`, `features_count` as the count of the identity's `featured_messages` in the stream, and `last_featured_at` as their latest `featured_at`. The merge SHALL NOT update `viewer_scores.user_id` in place (the generated `participant_key` would collide with the surviving row's primary key).

#### Scenario: Same stream, both identities scored

- **WHEN** a user chatted on Vids.Tube and on YouTube during the same stream before verifying
- **THEN** after the merge the stream has exactly one `viewer_scores` row for the user, whose `total_score` equals the sum of `score_events.points` across both origins

### Requirement: Ban collision keeps the earliest ban

When re-keying `banned_participants` (unique per channel and participant key): if only the YouTube identity is banned, the ban row SHALL be re-keyed so it follows the person; if both identities hold a ban for the same channel, the earliest-created row SHALL be kept and the other deleted.

#### Scenario: Ban follows the claimed identity

- **WHEN** a banned YouTube chatter verifies a link to an unbanned account
- **THEN** the account's participant key is banned in that channel after the merge

### Requirement: Membership collision resolution

When the source (unclaimed) channel and the survivor both hold a membership in the same community, the merge SHALL add the source's `credits` into the survivor's balance and union their `rewards` before deleting the source membership. All source memberships are then deleted (stream stats cascade), and `recompute_membership` SHALL run for the survivor in every community where either identity has raw-event history.

#### Scenario: Double membership in one community

- **WHEN** both identities held memberships in the same community with credits 30 and 20
- **THEN** the surviving membership has credits 50 and all derived fields freshly recomputed from pooled events

### Requirement: Identity key moves to the survivor; source becomes a tombstone

The merge SHALL clear `youtube_channel_id` on the source channel, set its `merged_into_channel_id` to the survivor, and set `youtube_channel_id` on the survivor. When no unclaimed source channel exists, the merge SHALL simply set the survivor's `youtube_channel_id`. If the YouTube channel id is already held by a **claimed** channel with a different owner, the merge SHALL abort with a conflict error and change nothing (contested identities are resolved manually, never automatically).

#### Scenario: No unclaimed channel exists yet

- **WHEN** a user verifies a link before unclaimed channels have been created (pre-AZ-170)
- **THEN** the merge sets the user's channel `youtube_channel_id` and recomputes their memberships, with no tombstone involved

#### Scenario: Contested identity aborts

- **WHEN** the linked YouTube channel id already belongs to a claimed channel owned by a different user
- **THEN** the merge aborts with a conflict error and no rows change

### Requirement: Merge is transactional and idempotent

The merge SHALL execute as a single transaction (all steps or none) and SHALL be safe to re-run: a second invocation for an already-merged identity finds no rows keyed to the old identity and results in no changes beyond a no-op recompute.

#### Scenario: Re-running a completed merge

- **WHEN** `merge_youtube_identity` runs a second time for the same verified user
- **THEN** it completes without error and no row values differ afterward

### Requirement: Backfill for existing history

A one-time service-role script (`scripts/backfill-memberships.ts`) SHALL run `merge_youtube_identity` for every already-verified `youtube_links` row, then run `recompute_membership` against the owner community for every channel whose identity keys appear in that community's raw events.

#### Scenario: Previously verified user gets pooled history

- **WHEN** the backfill runs for a user who verified their YouTube link before this change shipped
- **THEN** their YouTube-origin events are re-keyed and their owner-community membership reflects the pooled history
