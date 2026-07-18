## MODIFIED Requirements

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
