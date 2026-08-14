# overlay-tokens Specification

## Purpose
TBD - created by archiving change add-overlay-frame-tokens. Update Purpose after archive.
## Requirements
### Requirement: Each overlay holds a signing secret that only the host can read

Every registry row SHALL have a signing secret of its own, generated when the row is created and stored
apart from the row itself. The secret SHALL NOT be readable by any client, signed in or not, whatever the
overlay's status.

Tokens for an overlay SHALL be signed with that overlay's secret and no other.

#### Scenario: The secret is not public

- **WHEN** a signed-out client, or a signed-in client that owns a channel, reads the overlay registry
- **THEN** no signing secret is returned by any query available to it

#### Scenario: One overlay cannot verify another's token

- **GIVEN** two overlays, each with its own secret
- **WHEN** a token minted for the first is verified with the second's secret
- **THEN** verification fails

### Requirement: The frame is handed a signed token naming who it serves

The framed address SHALL carry a signed token in place of the installation id. The token SHALL be a JWT
signed with HS256 and SHALL name the issuer, the overlay it was minted for, the channel, the
installation, a subject, the kind of subject, an issue time and an expiry.

Identifiers in the token SHALL be stable ids rather than renameable names.

An overlay SHALL be able to verify the token offline, without contacting the host.

#### Scenario: An overlay learns which channel it is serving

- **GIVEN** an overlay installed on a channel
- **WHEN** the overlay route is loaded and the overlay verifies the token in its address
- **THEN** verification succeeds and yields that channel's id, that installation's id and that overlay's
  id

#### Scenario: A tampered token is refused

- **WHEN** any part of a token's payload is altered after signing
- **THEN** verification fails

#### Scenario: An expired token is refused

- **WHEN** a token is verified after its expiry
- **THEN** verification fails

### Requirement: A browser source is never presented as a person

The token SHALL state what kind of subject it names. A browser source SHALL be named as a source rather
than as a viewer, so that an overlay cannot mistake the streaming machine for a member of the audience.

The subject SHALL be opaque, and SHALL be derived per channel per overlay, so that two overlays cannot
recognise the same subject and one overlay cannot follow a subject between channels.

#### Scenario: The overlay route names a source

- **WHEN** the token in an overlay route's frame is verified
- **THEN** the subject kind is a source

#### Scenario: The same subject is unrecognisable across overlays

- **GIVEN** two overlays installed on the same channel
- **WHEN** the subject of each overlay's token is compared
- **THEN** the two subjects differ

#### Scenario: The same subject is unrecognisable across channels

- **GIVEN** one overlay installed on two channels
- **WHEN** the subject of each channel's token is compared
- **THEN** the two subjects differ

### Requirement: A live token can be exchanged for a fresh one

The host SHALL provide an endpoint that accepts a token which is validly signed and not yet expired, and
returns a freshly minted token for the same overlay, channel, installation and subject.

An invalid, expired, or unrecognised token SHALL be refused, and the refusal SHALL NOT reveal which of
those it was.

The frame SHALL NOT have to reload in order to obtain a fresh token, because reloading restarts whatever
the overlay was running.

#### Scenario: A live token is exchanged

- **WHEN** a token inside its lifetime is presented for exchange
- **THEN** a fresh token is returned naming the same overlay, channel, installation and subject, with a
  later expiry

#### Scenario: An expired token is not exchanged

- **WHEN** a token past its expiry is presented for exchange
- **THEN** the exchange is refused

#### Scenario: A forged token is not exchanged

- **WHEN** a token signed with anything other than the named overlay's secret is presented
- **THEN** the exchange is refused

### Requirement: Re-minting a token does not reload the frame

The framed address SHALL NOT change when the host mints a fresh token for an installation that has not
otherwise changed, so the running overlay is not restarted.

Where the installation itself changes, the framed address SHALL change.

#### Scenario: Polling does not restart the overlay

- **GIVEN** an overlay route whose installation query refetches on its interval
- **WHEN** a refetch returns a newly minted token for the same installation
- **THEN** the frame's address is unchanged

#### Scenario: Changing the installed overlay does swap the frame

- **WHEN** the channel's installation changes to a different overlay
- **THEN** the frame's address changes

