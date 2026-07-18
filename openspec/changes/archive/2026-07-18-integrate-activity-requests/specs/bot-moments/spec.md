## MODIFIED Requirements

### Requirement: Owner-fired wrap-up

The system SHALL send end-of-stream messages only on the owner's explicit
"Wrap up" action — a confirmed button in the bottom toolbar of the /live
page, placed immediately left of the "End stream" control while the stream is
live — never automatically. The wrap-up SHALL send, exactly once per stream,
whichever of three messages are enabled in Settings: the MVP announcement
(top scorer with points), an AI summary of what was achieved from the
transcript, and a thanks-for-watching message with the project links. A
second wrap-up request for the same stream SHALL do nothing.

#### Scenario: Wrap up lives beside End stream

- **WHEN** a stream is live
- **THEN** the toolbar shows Wrap up immediately left of End stream, and
  confirming it sends the enabled messages

#### Scenario: Wrap-up sends the enabled trio

- **WHEN** the owner confirms Wrap up with all three messages enabled
- **THEN** the bot posts the MVP, the achievement summary, and the thanks
  message (with project links) to both chats, once

#### Scenario: Wrap-up respects the toggles

- **WHEN** only the thanks message is enabled
- **THEN** wrap-up sends the thanks message and nothing else

#### Scenario: Wrap-up is idempotent

- **WHEN** Wrap up is requested twice for one stream
- **THEN** the messages send only once
