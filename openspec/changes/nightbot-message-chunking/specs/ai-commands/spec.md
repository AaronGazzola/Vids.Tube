# ai-commands Specification (delta)

## MODIFIED Requirements

### Requirement: Grounded moderated !ask

The system SHALL answer `!ask <question>` with a single AI pass that both
moderates the question and answers it. General-knowledge questions MAY be
answered from model knowledge; facts about the streamer, the channel, their
projects, or the stream SHALL come strictly from the provided grounding — the
channel's enabled custom-command content and the recent transcript window.
Questions failing moderation SHALL be dismissed silently with the reason
recorded; answerable questions SHALL follow the ask mode; unanswerable
questions SHALL receive a friendly can't-answer reply. Answers SHALL contain
no links that are not present in the grounding. Answers SHALL be capped at 600
characters — enforced by prompt instruction (targeting under ~550 characters)
and by truncation — and, together with the mention prefix, are delivered to
YouTube across multiple Nightbot messages when they exceed a single 400-character
send.

#### Scenario: Groundable question in auto mode

- **WHEN** a viewer asks something answered by the FAQ or transcript while
  `ask_mode` is `auto`
- **THEN** the bot replies with the grounded answer in the viewer's chat and the
  exchange is queued for the overlay

#### Scenario: General-knowledge question

- **WHEN** a viewer asks a benign general-knowledge question not covered by
  the grounding (e.g. "how many legs does an ant have")
- **THEN** the bot answers from model knowledge, following the ask mode

#### Scenario: Ungroundable question

- **WHEN** the question needs a streamer/channel/stream fact the grounding
  does not contain
- **THEN** the reply says the bot doesn't have that one and no exchange is
  queued

#### Scenario: Abusive question

- **WHEN** the question fails moderation
- **THEN** it is recorded as dismissed with the reason and nothing is replied or
  shown

#### Scenario: Long answer spans multiple sends

- **WHEN** an approved `!ask` answer plus its mention prefix exceeds 400
  characters
- **THEN** it is delivered as multiple `(n/m)`-tagged Nightbot messages rather
  than being cut off at 400

### Requirement: Cached !catchup summary

The system SHALL answer `!catchup` with a summary of the stream so far,
generated via the worker's Claude CLI from the stream transcript and cached per
stream for a short TTL, serving the cache within that window without a fresh AI
call. The summary SHALL be capped at 600 characters — enforced by prompt
instruction (targeting under ~550 characters) and by truncation — and is
delivered to YouTube across multiple Nightbot messages when it exceeds a single
400-character send. When there is no transcript yet, the reply SHALL say there is
nothing to catch up on.

#### Scenario: Cached summary within TTL

- **WHEN** `!catchup` is used twice within the cache TTL for the same stream
- **THEN** the second reply serves the cached summary without a fresh AI call

#### Scenario: Long summary spans multiple sends

- **WHEN** a generated `!catchup` summary exceeds 400 characters
- **THEN** it is delivered as multiple `(n/m)`-tagged Nightbot messages rather
  than being cut off at 400

#### Scenario: Nothing to summarize yet

- **WHEN** `!catchup` runs before any transcript exists for the stream
- **THEN** the reply says there is nothing to catch up on yet
