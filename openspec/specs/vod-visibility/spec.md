# vod-visibility Specification

## Purpose
TBD - created by archiving change vod-visibility. Update Purpose after archive.
## Requirements
### Requirement: Every recording carries a visibility

A recording SHALL carry a visibility of `public`, `unlisted` or `private`, held
independently of its processing state. A recording SHALL default to `public`.

#### Scenario: A newly finalized recording

- **WHEN** a broadcast finishes and its recording is published
- **THEN** the recording is public, as recordings are today

#### Scenario: Visibility and processing state are independent

- **WHEN** a recording is private and finishes processing
- **THEN** the recording is ready and private, and neither value has changed the
  other

### Requirement: A public recording is listed and reachable

A public recording SHALL be listed on its channel and SHALL be playable by
anyone, signed in or not.

#### Scenario: Anyone opens a public recording

- **WHEN** a visitor who is not signed in opens a public recording
- **THEN** the recording plays

#### Scenario: A public recording appears on the channel

- **WHEN** a visitor views the channel
- **THEN** public recordings are listed

### Requirement: An unlisted recording is reachable only by its address

An unlisted recording SHALL be playable by anyone holding its address, and
SHALL NOT appear in any listing.

#### Scenario: Opening an unlisted recording directly

- **WHEN** a visitor opens an unlisted recording by its own address
- **THEN** the recording plays

#### Scenario: An unlisted recording is not listed

- **WHEN** a visitor views the channel
- **THEN** unlisted recordings do not appear

### Requirement: A private recording is reachable only by the owner

A private recording SHALL be readable only by the channel owner. Every other
reader SHALL receive not-found, so the existence of the recording is not
disclosed.

#### Scenario: A visitor opens a private recording by its address

- **WHEN** a visitor who is not the owner opens a private recording by its
  address
- **THEN** not-found is returned
- **AND** nothing in the response reveals that the recording exists

#### Scenario: The owner opens their own private recording

- **WHEN** the channel owner opens a private recording
- **THEN** the recording plays

#### Scenario: A private recording stays visible to its owner in the studio

- **WHEN** the owner lists recordings in the studio
- **THEN** private recordings are listed, marked as private

### Requirement: Visibility is enforced by the database, not by the page

Enforcement SHALL sit in the row read policy, so a reader querying the table
directly is bound by the same rule as a reader loading a page.

#### Scenario: Querying the table directly

- **WHEN** a private recording is requested directly from the table by a reader
  who is not the owner
- **THEN** no row is returned

### Requirement: The owner sets visibility

The channel owner SHALL be able to set a recording to public, unlisted or
private, and no one else SHALL be able to change it.

#### Scenario: Changing visibility

- **WHEN** the owner sets a recording to private in the studio
- **THEN** the recording stops being reachable by anyone else, without its
  processing state changing

#### Scenario: Only the owner may change it

- **WHEN** anyone other than the channel owner attempts to change visibility
- **THEN** the change is rejected

### Requirement: Existing recordings keep their current reach

Adding visibility SHALL NOT change what any existing recording is reachable by,
with the single deliberate exception of the recording currently withheld by
being marked a processing failure.

#### Scenario: Migration

- **WHEN** the visibility column is added
- **THEN** every existing recording becomes public, so nothing that is currently
  visible disappears

#### Scenario: The withheld broadcast

- **WHEN** the migration runs
- **THEN** the 8-Aug-2026 recording becomes private
- **AND** its processing state is corrected from failed back to ready, because
  it was marked failed only in order to hide it

