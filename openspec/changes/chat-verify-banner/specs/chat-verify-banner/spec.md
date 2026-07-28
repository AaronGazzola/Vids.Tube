# chat-verify-banner Specification (delta)

## ADDED Requirements

### Requirement: Banner visibility

The system SHALL render a YouTube verify banner at the top of the Vids.Tube live chat panel only for signed-in users whose YouTube link is not yet verified. The banner SHALL NOT render for anonymous visitors, and SHALL render nothing (not even a collapsed bar) once the user's link is verified.

#### Scenario: Signed-in unverified user sees the banner

- **WHEN** a signed-in user with no verified YouTube link views the live chat
- **THEN** the verify banner renders at the top of the chat panel

#### Scenario: Verified user sees nothing

- **WHEN** a signed-in user whose link is verified views the live chat
- **THEN** neither the banner nor a collapsed bar renders

#### Scenario: Anonymous visitor sees nothing

- **WHEN** an anonymous visitor views the live chat
- **THEN** no banner renders

### Requirement: Code-only content

The banner SHALL show a unique verify code for the signed-in user with a copy button, an instruction to post the code in the owner's YouTube live chat from their YouTube account, and a control to regenerate the code. The banner SHALL NOT ask the user to type a YouTube handle — the code alone identifies the account, and the YouTube channel is learned from whoever posts the code. The code SHALL be created on demand for the signed-in user if none exists.

#### Scenario: Code shown with copy

- **WHEN** the banner renders for a signed-in unverified user
- **THEN** it shows a verify code, a working copy button, the paste instruction, and no handle input

#### Scenario: Regenerate replaces the code

- **WHEN** the user activates the regenerate control
- **THEN** a new unique code is generated and displayed, and the previous code no longer verifies

### Requirement: Collapse to a thin re-expandable bar

Collapsing the banner SHALL NOT hide it entirely; it SHALL collapse to a thin bar that can be re-expanded on click. The collapsed state SHALL be per-session and SHALL NOT be persisted across sessions.

#### Scenario: Collapse shrinks to a thin bar

- **WHEN** an unverified user collapses the banner
- **THEN** it shrinks to a thin bar showing a short label, still visible in the chat panel

#### Scenario: Re-expand from the thin bar

- **WHEN** the user clicks the thin collapsed bar
- **THEN** the full banner with the code re-expands

### Requirement: Reactive hide on verification

The banner SHALL reflect a verification that lands during the session (the worker verifying the code) and disappear without a manual page refresh.

#### Scenario: Mid-session verification clears the banner

- **WHEN** the worker verifies the user's code while they are viewing the chat
- **THEN** the banner (and any collapsed bar) disappears on the next refetch without a manual reload
