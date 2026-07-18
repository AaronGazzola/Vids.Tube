## MODIFIED Requirements

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
