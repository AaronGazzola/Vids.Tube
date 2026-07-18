## MODIFIED Requirements

### Requirement: Cached AI profile with regeneration thresholds

The system SHALL cache each identity's generated bio in `me_profiles` with the
stats snapshot it was generated from, serving the cache instantly and
regenerating via the worker's Claude CLI when any of these hold: total
messages moved by at least 20, the attended videos/streams count changed, or
the cached bio was generated before the engaged stream started — so every
stream gets a fresh bio on first use. The bio SHALL be written in the third
person using the chatter's display name, warm and playful, grounded only in
the gathered stats plus a sample of the chatter's own recent messages (up to
8 recent `chat_messages` for the identity and up to 8 recent
`youtube_chat_archive` messages by channel id, each clipped to 120
characters) so it can nod to what they actually talk about. The bio SHALL
never exceed 400 characters — enforced by prompt instruction and by
truncation before caching.

#### Scenario: Cache hit is instant within a stream

- **WHEN** a chatter repeats `!me` in the same stream with unchanged stats
- **THEN** the cached bio is replied without any AI call

#### Scenario: New stream regenerates

- **WHEN** a chatter uses `!me` and the cached bio predates the current
  stream's start
- **THEN** the bio regenerates before replying and the cache is updated

#### Scenario: Third person with tidbits

- **WHEN** a bio is generated for a chatter with message history
- **THEN** it refers to them by name in the third person and may reference
  the kinds of things they say in chat, drawn only from the sampled messages

#### Scenario: Hard length cap

- **WHEN** the model returns text longer than 400 characters
- **THEN** the stored and delivered bio is truncated to at most 400 characters
