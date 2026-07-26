# chat-verify-banner Specification (delta)

## ADDED Requirements

### Requirement: Banner visibility

The system SHALL render a YouTube verify banner at the top of the Vids.Tube live chat panel only for signed-in users whose `youtube_links` row is missing or has `verified_at IS NULL`. The banner SHALL NOT render for anonymous visitors or for users with a verified link.

#### Scenario: Signed-in unverified user sees the banner

- **WHEN** a signed-in user with no link, or an unverified link, views the live chat
- **THEN** the verify banner renders at the top of the chat panel

#### Scenario: Verified user sees no banner

- **WHEN** a signed-in user whose link is verified views the live chat
- **THEN** no verify banner renders

#### Scenario: Anonymous visitor sees no banner

- **WHEN** an anonymous visitor views the live chat
- **THEN** no verify banner renders

### Requirement: Has-code state

When the signed-in user has an unverified `youtube_links` row, the banner SHALL display the 6-character `verify_code` with a copy button and an instruction to paste the code into the YouTube live chat, and SHALL offer a control to regenerate the code.

#### Scenario: Code shown with copy

- **WHEN** the banner renders for a user with an unverified link
- **THEN** it shows the verify code, a working copy button, and the paste instruction

#### Scenario: Regenerate replaces the code

- **WHEN** the user activates the regenerate control
- **THEN** a new code is generated and displayed, and the previous code no longer verifies

### Requirement: No-link state

When the signed-in user has no `youtube_links` row, the banner SHALL let them start the claim inline by entering their YouTube `@handle`, and on success SHALL transition to the has-code state. It SHALL also provide a link to the Account YouTube-link card.

#### Scenario: Inline handle entry starts the claim

- **WHEN** a user with no link enters a valid `@handle` in the banner
- **THEN** a link is created with a fresh code and the banner switches to the has-code state

#### Scenario: Unknown handle is rejected

- **WHEN** a user enters a handle that matches no YouTube channel
- **THEN** the banner shows a clear error and no link is created

### Requirement: Reactive hide on verification

The banner SHALL reflect a verification that lands during the session (the worker setting `verified_at`) and disappear without a manual page refresh.

#### Scenario: Mid-session verification clears the banner

- **WHEN** the worker verifies the user's link while they are viewing the chat
- **THEN** the banner disappears on the next refetch without a manual reload

### Requirement: Per-session dismissal

The banner SHALL be dismissible; a dismissed banner SHALL stay hidden for the remainder of the session and SHALL reappear on a later visit while the link is still unverified. The dismissal state SHALL NOT be persisted across sessions.

#### Scenario: Dismiss hides for the session

- **WHEN** an unverified user dismisses the banner
- **THEN** it stays hidden for the rest of the session

#### Scenario: Reappears next session until verified

- **WHEN** the same unverified user returns in a new session
- **THEN** the banner reappears
