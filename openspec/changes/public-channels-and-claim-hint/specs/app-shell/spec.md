# app-shell Specification (delta)

## ADDED Requirements

### Requirement: Your channel sidebar entry

The sidebar SHALL show a single "Your channel" navigation entry for signed-in users that links to their own account channel (`/{account-handle}`). It SHALL NOT render for anonymous visitors, and there SHALL be exactly one channel nav target (the vids.tube account channel, which becomes the combined identity after verification).

#### Scenario: Signed-in user sees their channel link

- **WHEN** a signed-in user with an account channel views the sidebar
- **THEN** a "Your channel" entry links to their account channel page

#### Scenario: Anonymous visitor sees no channel link

- **WHEN** an anonymous visitor views the sidebar
- **THEN** no "Your channel" entry renders
