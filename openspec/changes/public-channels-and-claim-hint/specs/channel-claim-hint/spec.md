# channel-claim-hint Specification (delta)

## ADDED Requirements

### Requirement: Verify-code hint on the owner's own channel

On a signed-in user's own channel page, while their YouTube link is unverified, the system SHALL show a hint containing their code-first verify code (the same code as the live-chat banner) with a copy control and an instruction to post it in the stream's YouTube chat to claim their YouTube profile. The hint SHALL render only for the channel's own owner and SHALL disappear once the link is verified.

#### Scenario: Owner sees the code hint

- **WHEN** the signed-in owner views their own channel and their YouTube link is unverified
- **THEN** a hint shows their verify code with copy + regenerate and the claim instruction

#### Scenario: Hidden once verified

- **WHEN** the owner's YouTube link becomes verified
- **THEN** the hint no longer renders

#### Scenario: Not shown to other viewers

- **WHEN** a visitor who does not own the channel views it
- **THEN** no verify-code hint renders
