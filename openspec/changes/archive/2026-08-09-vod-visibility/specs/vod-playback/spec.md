## MODIFIED Requirements

### Requirement: Public read of ready VODs only

The system SHALL expose through the public read path only VODs that are both
`ready` **and** visible to the reader. Rows in `processing` or `failed` state
SHALL NOT be readable by clients, and neither SHALL a `ready` row whose
visibility withholds it from that reader.

Processing state alone no longer decides who may read a row. A row is readable
when processing has finished and one of the following holds: its visibility is
`public`; its visibility is `unlisted`; or the reader owns the channel it
belongs to.

An `unlisted` row is readable, so that a recording can be reached by its own
address, and is excluded from listings by the listing requirement rather than by
the read policy.

#### Scenario: Ready public VOD is publicly readable

- **WHEN** anyone (anonymous or authenticated) queries `videos`
- **THEN** row-level security returns rows whose `status` is `ready` and whose
  visibility is `public`, and withholds `processing`/`failed` rows

#### Scenario: Ready private VOD is withheld from everyone but its owner

- **WHEN** a reader who does not own the channel queries `videos`
- **THEN** rows whose visibility is `private` are withheld, whatever their
  status

#### Scenario: The owner reads their own withheld VODs

- **WHEN** the channel owner queries `videos`
- **THEN** their own rows are returned whatever their visibility, so the studio
  can list them

### Requirement: Channel VOD listing

The channel page SHALL list a channel's `ready` VODs whose visibility is
`public`, newest first. `unlisted` VODs SHALL NOT appear in the listing even
though they remain readable by address, and `private` VODs SHALL NOT appear to
anyone but the owner.

#### Scenario: A channel with public and unlisted recordings

- **WHEN** a visitor views a channel holding both public and unlisted recordings
- **THEN** only the public recordings are listed

#### Scenario: The owner views their own channel

- **WHEN** the channel owner views their own channel
- **THEN** withheld recordings are listed and marked with their visibility, so
  the owner can see what is not public
