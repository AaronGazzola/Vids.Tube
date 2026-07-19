# ai-commands Specification

## Purpose

AI-grounded viewer commands: !ask answers general-knowledge questions from
model knowledge and channel/streamer questions strictly from the channel FAQ
and live transcript, with suggest/auto gating and answer withholding, shown
on the overlay as a mirrored Q&A; !catchup serves a cached summary of the
stream so far.

## Requirements

### Requirement: Grounded moderated !ask

The system SHALL answer `!ask <question>` with a single AI pass that both
moderates the question and answers it. General-knowledge questions MAY be
answered from model knowledge; facts about the streamer, the channel, their
projects, or the stream SHALL come strictly from the provided grounding — the
channel's enabled custom-command content and the recent transcript window.
Questions failing moderation SHALL be dismissed silently with the reason
recorded; answerable questions SHALL follow the ask mode; unanswerable
questions SHALL receive a friendly can't-answer reply. Answers SHALL contain
no links that are not present in the grounding.

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

### Requirement: Suggest mode with answer withholding

In suggest mode an exchange SHALL be created as `suggested` (question, answer,
reasoning) and surfaced inline in the Activity chat: the `!ask` message
renders as a sky-accented card previewing the AI answer, with three controls —
**Answer** (approve and include the AI answer), **Question only** (approve
with the answer withheld everywhere: not chat, not overlay), and **Dismiss**.
After the owner acts the card relaxes to normal chat styling with a sky
status chip. There SHALL be no separate Ask panel. When approved with the
answer, the answer SHALL also be delivered to the asker's chat origin.

#### Scenario: Approve with the answer

- **WHEN** the owner clicks Answer on a suggested ask card
- **THEN** the answer is sent to chat, and the overlay shows the question with
  the answer

#### Scenario: Approve the question only

- **WHEN** the owner clicks Question only
- **THEN** the overlay shows only the question and the answer is not sent to
  chat

#### Scenario: Status visible after handling

- **WHEN** an exchange reaches `approved`, `shown`, or `dismissed`
- **THEN** its chat row renders as a normal message with a sky chip naming the
  status

### Requirement: Overlay Q&A display

The overlay SHALL render an approved exchange in the highlight visual
language: the question exactly like a highlighted message — the asker's
avatar bubble (with standings ring) top-left, name beneath, question in the
shared speech bubble — and, when included, the answer beneath it mirrored:
the speech bubble on the left with its pointer pointing right at an indigo
bot icon labeled VidsBot on the right. The exchange SHALL hold about 10
seconds then be marked `shown` so it never repeats, and SHALL occupy the
single shared overlay slot — never rendering at the same time as a
highlighted message or TTS card.

#### Scenario: Exchange renders mirrored

- **WHEN** an approved exchange with an included answer reaches the overlay
- **THEN** the question shows avatar-left in the highlight style and the
  answer below it in a left-side bubble whose pointer points right at the
  VidsBot icon, then the exchange is marked shown

#### Scenario: Waits for the slot

- **WHEN** a TTS card is playing when an exchange becomes shown-ready
- **THEN** the exchange waits for the slot and then appears in the same
  screen position

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
