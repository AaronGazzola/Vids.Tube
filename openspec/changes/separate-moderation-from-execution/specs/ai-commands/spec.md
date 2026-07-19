## MODIFIED Requirements

### Requirement: Grounded moderated !ask

The system SHALL answer `!ask <question>` with a single AI pass that both
moderates the question and answers it. General-knowledge questions MAY be
answered from model knowledge; facts about the streamer, the channel, their
projects, or the stream SHALL come strictly from the provided grounding — the
channel's enabled custom-command content and the recent transcript window.
The AI pass SHALL attempt the answer regardless of the moderation verdict.
Questions failing moderation SHALL be recorded as `suggested` with
`flagged: true` and the reason — silent toward the viewer (no reply) and
never auto-approved, even in auto mode. Answerable passing questions SHALL
follow the ask mode; unanswerable passing questions SHALL receive a friendly
can't-answer reply. Answers SHALL contain no links that are not present in
the grounding.

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

#### Scenario: Flagged question

- **WHEN** the question fails moderation
- **THEN** it is recorded as `suggested` with `flagged: true`, its answer
  still generated when possible, nothing is replied to the viewer, and it is
  never auto-approved — even while `ask_mode` is `auto`

### Requirement: Suggest mode with answer withholding

In suggest mode an exchange SHALL be created as `suggested` (question, answer,
reasoning) and surfaced inline in the Activity chat: the `!ask` message
renders as a sky-accented card previewing the AI answer, with three controls —
**Answer** (approve and include the AI answer), **Question only** (approve
with the answer withheld everywhere: not chat, not overlay), and **Dismiss**.
A flagged exchange SHALL render on the same card with an amber "flagged" chip
and the moderation reason, and SHALL offer the same controls. After the owner
acts the card relaxes to normal chat styling with a sky status chip. There
SHALL be no separate Ask panel. When approved with the answer, the answer
SHALL also be delivered to the asker's chat origin.

#### Scenario: Approve with the answer

- **WHEN** the owner clicks Answer on a suggested ask card
- **THEN** the answer is sent to chat, and the overlay shows the question with
  the answer

#### Scenario: Approve the question only

- **WHEN** the owner clicks Question only
- **THEN** the overlay shows only the question and the answer is not sent to
  chat

#### Scenario: Approve a flagged exchange

- **WHEN** the owner clicks Answer or Question only on a flagged ask card
- **THEN** the exchange proceeds exactly like a non-flagged approval — chat
  delivery and overlay per the chosen control

#### Scenario: Status visible after handling

- **WHEN** an exchange reaches `approved`, `shown`, or `dismissed`
- **THEN** its chat row renders as a normal message with a sky chip naming the
  status
