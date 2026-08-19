## ADDED Requirements

### Requirement: The live chat panel filters to featured messages only

The Activity tab's live chat panel SHALL offer a toggle between showing every message and showing only
the messages featured for the current broadcast.

The toggle SHALL be a view filter alone. Flipping it SHALL NOT change what is scored, what is featured,
what the overlay shows, or any stored setting, and its state SHALL NOT outlive the page.

A filtered message SHALL be drawn by the same row component, with the same moderation, highlight, TTS,
ask and clip affordances, as it is when unfiltered.

While the filter is on and nothing has been featured yet, the panel SHALL say that nothing has been
featured yet, distinctly from the message it shows when no chat has arrived at all.

#### Scenario: Filtering to highlights

- **GIVEN** a broadcast whose chat holds both featured and unfeatured messages
- **WHEN** the streamer turns the highlights-only filter on
- **THEN** only the featured messages remain listed, each drawn exactly as before

#### Scenario: Nothing featured yet

- **GIVEN** a broadcast with chat but nothing featured
- **WHEN** the highlights-only filter is on
- **THEN** the panel says nothing has been featured yet, rather than showing the no-messages text or an
  empty box

#### Scenario: The filter changes nothing but the view

- **WHEN** the filter is turned on and off
- **THEN** no request is made to change any stored state, and the overlay is unaffected

#### Scenario: A featured command message is listed

- **GIVEN** a `!tts` message that the AI featured
- **WHEN** the highlights-only filter is on
- **THEN** that message is listed like any other featured message
