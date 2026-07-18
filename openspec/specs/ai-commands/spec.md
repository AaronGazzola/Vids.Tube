# ai-commands Specification

## Purpose

AI-grounded viewer commands: !ask answers questions strictly from the channel
FAQ and live transcript with suggest/auto gating and answer withholding, shown
on the overlay as a mirrored Q&A; !catchup serves a cached summary of the
stream so far.

## Requirements

### Requirement: Grounded moderated !ask

The system SHALL answer `!ask <question>` with a single AI pass that both
moderates the question and answers it strictly from the provided grounding —
the channel's enabled custom-command content and the recent transcript window.
Questions failing moderation SHALL be dismissed silently with the reason
recorded; groundable answers SHALL follow the ask mode; ungroundable questions
SHALL receive a friendly can't-answer reply. Answers SHALL contain no links
that are not present in the grounding.

#### Scenario: Groundable question in auto mode

- **WHEN** a viewer asks something answered by the FAQ or transcript while
  `ask_mode` is `auto`
- **THEN** the bot replies with the grounded answer in the viewer's chat and the
  exchange is queued for the overlay

#### Scenario: Ungroundable question

- **WHEN** the grounding contains no answer
- **THEN** the reply says the bot doesn't have that one and no exchange is
  queued

#### Scenario: Abusive question

- **WHEN** the question fails moderation
- **THEN** it is recorded as dismissed with the reason and nothing is replied or
  shown

### Requirement: Suggest mode with answer withholding

In suggest mode an exchange SHALL be created as `suggested` (question, answer,
reasoning) and surfaced in an Activity-tab panel where the owner approves or
dismisses it; approval SHALL carry an "include AI response" checkbox — when
unchecked, the question is approved for the overlay but the answer appears
nowhere (not chat, not overlay). When checked, approval SHALL also deliver the
answer to the asker's chat origin.

#### Scenario: Approve with the answer

- **WHEN** the owner approves a suggestion with include-answer checked
- **THEN** the answer is sent to chat, and the overlay shows the question with
  the answer

#### Scenario: Approve the question only

- **WHEN** the owner approves with include-answer unchecked
- **THEN** the overlay shows only the question and the answer is not sent to
  chat

### Requirement: Overlay Q&A display

The highlight overlay SHALL render an approved exchange as the question in the
highlight-message style with — when included — the answer below in a mirrored
bot layout (bot avatar on the right, bubble on the left), hold it about 10
seconds, then mark the exchange `shown` so it never repeats.

#### Scenario: Exchange renders mirrored

- **WHEN** an approved exchange with an included answer reaches the overlay
- **THEN** the question shows in the standard highlight style and the answer
  below it mirrored with the bot avatar on the right, then the exchange is
  marked shown

### Requirement: Cached !catchup summary

The system SHALL answer `!catchup` with a ≤400-character summary of the
stream's transcript so far, cached in the worker for 3 minutes so repeat calls
within the window reuse the cached text with no AI call, and SHALL reply with a
friendly line when no transcript exists yet.

#### Scenario: Summary served and cached

- **WHEN** two viewers call `!catchup` within three minutes on a stream with
  transcript
- **THEN** both receive the same ≤400-char summary and Claude runs only once

#### Scenario: No transcript yet

- **WHEN** `!catchup` runs before any transcript exists
- **THEN** the reply says there is nothing to catch up on yet
