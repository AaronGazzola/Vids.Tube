## ADDED Requirements

### Requirement: A member's moment is announced by their resolved sound

The overlay SHALL announce a highlighted message with the resolved sound of the
member whose message it is, in place of the fixed two-note bell. The bell
remains what plays when no sound resolves for that member.

The overlay SHALL resolve that sound alongside the identity it already resolves
when fetching highlights, so no additional identity lookup is introduced.

The existing overlay sound switch SHALL continue to silence the announcement
entirely, whatever resolved.

#### Scenario: A member with an approved sound is highlighted

- **WHEN** a message from a member whose own sound is approved is highlighted
- **THEN** the moment is announced by that member's sound rather than the bell

#### Scenario: A member with no sound is highlighted

- **WHEN** a message from a member with no sound at all is highlighted
- **THEN** the moment is announced by the default bell as before

#### Scenario: Overlay sound is switched off

- **WHEN** the overlay's sound switch is off and a message is highlighted
- **THEN** nothing is played, whatever sound would have resolved
