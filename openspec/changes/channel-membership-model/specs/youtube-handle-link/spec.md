# youtube-handle-link Specification (delta)

## MODIFIED Requirements

### Requirement: Chat-code verification

The system SHALL verify link ownership through the owner's YouTube live chat:
the account card shows a short code; while the worker is engaged, a
YouTube-origin chat message whose trimmed text equals an outstanding code AND
whose author channel id equals the claimed channel id SHALL mark the link
verified. A matching code from any other author SHALL be ignored. The card SHALL
show unverified state with instructions and the code, a control to generate a
new code, verified state once confirmed, and an Unlink action that deletes the
link. Immediately after marking a link verified, the worker SHALL invoke the
identity merge (`merge_youtube_identity`) for that user; a merge failure SHALL
be logged and SHALL NOT block the rest of the batch or undo the verification.

#### Scenario: Code posted from the claimed channel verifies

- **WHEN** the claimed YouTube channel posts exactly the verify code in the
  owner's live chat while the worker is engaged
- **THEN** the link's `verified_at` is set and the card shows verified

#### Scenario: Code posted by someone else is ignored

- **WHEN** a different YouTube channel posts the same code
- **THEN** the link stays unverified

#### Scenario: Changing the handle resets verification

- **WHEN** a verified user saves a different handle
- **THEN** the link becomes unverified with a fresh code

#### Scenario: Verification pools the YouTube history

- **WHEN** a link is marked verified for a user who owns a channel
- **THEN** the worker calls the identity merge for that user, pooling their
  YouTube-origin history onto their channel
