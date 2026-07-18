## MODIFIED Requirements

### Requirement: Overlay playback

The overlay page SHALL play approved-with-audio requests serially — one at a
time, in approval order — through the browser source (so OBS mixes it into
the stream), SHALL display the spoken message in the highlight visual style
(the requester's avatar bubble with their standings ring top-left, name
beneath, and the message in the shared speech bubble with a speaker icon),
and SHALL mark each row `played` when playback ends (or errors) so it never
replays. TTS SHALL occupy the single shared overlay slot: it never renders at
the same time as a highlighted message or an ask exchange, and its audio
starts only when its card holds the slot.

#### Scenario: Serial playback with highlight-style display

- **WHEN** two approved requests have audio
- **THEN** the overlay plays them one after another in the highlight style —
  avatar, name, speech bubble — marking each `played`

#### Scenario: Waits for the slot

- **WHEN** a highlighted message is on screen when a TTS request becomes
  playable
- **THEN** the TTS card (and its audio) waits until the highlight finishes,
  then takes the same screen position

#### Scenario: No replay

- **WHEN** a request has been marked `played`
- **THEN** it is never rendered or played again
