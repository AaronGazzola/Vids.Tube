## ADDED Requirements

### Requirement: The banner's display time is configured, globally and per message

The message banner SHALL cycle each message for a configured display time rather than a fixed one.

A global display time SHALL apply to every message that does not carry its own. A message MAY carry its
own display time, which SHALL take precedence over the global one for that message alone.

Carrying no time of its own SHALL be stored and treated as distinct from carrying a time equal to the
global one. Changing the global time SHALL move every message that carries no time of its own, and SHALL
move no message that does.

Both times SHALL be bounded to a range the banner can actually show, and a stored value outside that
range SHALL be treated as the global one rather than honoured.

The same times SHALL drive the OBS route and the Overlays tab, so the setting can be judged without going
live.

#### Scenario: The global time applies

- **GIVEN** a banner with three messages and none carrying its own time
- **WHEN** the global display time is changed
- **THEN** all three messages cycle at the new time, on the OBS route and in the Overlays tab alike

#### Scenario: A message overrides the global

- **GIVEN** a banner where the second message carries its own display time
- **WHEN** the global display time is changed
- **THEN** the second message keeps its own time and the others take the new global one

#### Scenario: Unset is not the same as equal

- **GIVEN** one message with no time of its own and one whose own time equals the current global
- **WHEN** the global time is changed
- **THEN** the first message moves to the new time and the second does not

#### Scenario: A layout saved before the setting existed

- **GIVEN** a layout saved with no global time and no per-message time
- **WHEN** the banner is drawn
- **THEN** every message cycles at the current default, and nothing about the saved layout is discarded

#### Scenario: An unusable stored time

- **GIVEN** a stored display time below the transition length or absurdly large
- **WHEN** the banner is drawn
- **THEN** the global time is used for that message instead

### Requirement: The message banner's border is switchable

The message banner SHALL offer a setting turning its border off. With the border off the banner SHALL
draw its text and its metric with no frame and no backing surface; with it on the banner SHALL be drawn
exactly as it is today.

The setting SHALL apply identically to the OBS route and the Overlays tab, both drawn by the shared
renderer.

A layout saved before the setting existed SHALL draw its border, so no existing channel's overlay changes
on deploy.

#### Scenario: Turning the border off

- **WHEN** the streamer turns the banner's border off
- **THEN** the banner shows its text and metric with no frame or backing, on both surfaces

#### Scenario: The border survives an old layout

- **GIVEN** a layout saved before the border setting existed
- **WHEN** the banner is drawn
- **THEN** the border is drawn as it is today

#### Scenario: Opacity still applies

- **GIVEN** the border is on and the banner's opacity has been wound down
- **THEN** the backing honours the opacity exactly as it does today
