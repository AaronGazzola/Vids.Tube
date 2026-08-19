## ADDED Requirements

### Requirement: A member's sound precedes their spoken message

The overlay SHALL play the resolved sound of the member who requested a spoken
message before that message is spoken, and SHALL begin the spoken audio when the
sound has finished, so the two never overlap.

Where no sound resolves for that member, the default bell SHALL precede the
spoken audio on the same terms.

Where the sound cannot be loaded, or runs past the playback bound, the spoken
audio SHALL begin anyway rather than be lost.

#### Scenario: A sound plays before the spoken message

- **WHEN** a spoken message from a member with an approved sound reaches the overlay
- **THEN** that member's sound plays first and the spoken audio begins once the sound has finished

#### Scenario: A failed sound does not lose the spoken message

- **WHEN** the resolved sound cannot be loaded
- **THEN** the spoken audio begins regardless
