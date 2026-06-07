## ADDED Requirements

### Requirement: Channel record

The system SHALL store channels as records with an owner, a unique slug, a name,
and a description, modeled to support many channels even though v1 has one.

#### Scenario: Channel has a unique slug

- **WHEN** a channel is created with a slug that already exists
- **THEN** the system rejects the creation because slugs MUST be unique

### Requirement: Public channel readability

The system SHALL allow anyone, including anonymous visitors, to read channel
records.

#### Scenario: Anonymous read

- **WHEN** an anonymous visitor requests channel data
- **THEN** the system returns the channel record without requiring authentication

### Requirement: Owner-only channel mutation

The system SHALL allow a user to create, update, or delete only channels they
own.

#### Scenario: User creates their own channel

- **WHEN** an authenticated user inserts a channel with their own user id as owner
- **THEN** the system allows the insert

#### Scenario: User cannot create a channel owned by someone else

- **WHEN** an authenticated user inserts a channel whose owner id is a different
  user
- **THEN** the system rejects the insert

#### Scenario: User cannot modify another user's channel

- **WHEN** an authenticated user attempts to update or delete a channel they do
  not own
- **THEN** the system rejects the operation

### Requirement: Public channel page

The system SHALL render a public page for a channel addressed by its slug. The
page shell SHALL render immediately, with the data-dependent channel content
fetched via a React Query hook and shown with inline loading skeletons while
loading.

#### Scenario: Existing channel renders

- **WHEN** a visitor opens the page for an existing channel slug
- **THEN** the system displays the channel name and description after the channel
  query resolves

#### Scenario: Loading state

- **WHEN** the channel query is in flight
- **THEN** the page shell is visible and the channel name/description areas show
  inline loading skeletons

#### Scenario: Unknown channel shows a not-found state

- **WHEN** a visitor opens the page for a slug that has no channel
- **THEN** the channel query returns no row and the page displays a not-found
  state
