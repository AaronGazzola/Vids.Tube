## ADDED Requirements

### Requirement: !tts costs one credit

The `!tts` command SHALL cost one credit, making it the first thing credits can be spent on.

The price SHALL be carried on the command's registry row like any other command's price, so the owner can
change it without a deploy.

A chatter who cannot afford it SHALL be refused before any synthesis is requested, so an unaffordable
request never reaches the moderation queue and never spends the synthesis budget.

#### Scenario: A chatter spends a credit to be heard

- **GIVEN** a chatter holding at least one credit
- **WHEN** they use `!tts`
- **THEN** one credit is deducted and the request enters the moderation queue as it does today

#### Scenario: An unaffordable request never reaches synthesis

- **GIVEN** a chatter holding no credits
- **WHEN** they use `!tts`
- **THEN** no TTS request is created, nothing is synthesised, and they are told the price and their
  balance

#### Scenario: A newly arrived member can be heard

- **GIVEN** a chatter who has just joined and holds only their joining grant
- **WHEN** they use `!tts`
- **THEN** it is charged and executes, and their remaining balance covers four further uses
