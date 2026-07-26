# bot-moments Specification (delta)

## ADDED Requirements

### Requirement: AI moment message length and chunked delivery

The system SHALL cap AI-generated moment messages (the useful-info answer and
the wrap-up achievement summary) at 600 characters, enforced by prompt
instruction targeting under ~550 characters and by truncation. Any moment
message that exceeds a single 400-character Nightbot send SHALL be delivered to
YouTube across multiple `(n/m)`-tagged messages rather than truncated. Fixed
moment strings (the MVP line, the thanks-with-links line) SHALL keep their
wording and be chunked only when they exceed 400 characters.

#### Scenario: Long wrap-up summary spans multiple sends

- **WHEN** a wrap-up achievement summary exceeds 400 characters
- **THEN** it is delivered as multiple `(n/m)`-tagged Nightbot messages rather
  than being cut off at 400

#### Scenario: Short moment sent as one message

- **WHEN** a moment message is 400 characters or fewer
- **THEN** it is sent as a single Nightbot message with no continuation marker
