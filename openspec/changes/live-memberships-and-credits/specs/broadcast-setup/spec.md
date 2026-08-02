## ADDED Requirements

### Requirement: Chatter enrichment switch in the settings tab

The `/live` settings tab SHALL offer the channel owner a switch controlling how much is fetched when a previously unknown chatter first speaks during a broadcast. The switch SHALL persist to the owner's channel rather than to a single broadcast, SHALL default to fetching the chatter's real YouTube handle and high-resolution avatar immediately, and SHALL be readable by the worker for the duration of any broadcast on that channel.

#### Scenario: Owner turns off immediate enrichment

- **WHEN** the owner turns the switch off in the settings tab
- **THEN** the channel's enrichment mode becomes `deferred` and chatters onboarded in later broadcasts are created from the display name on their message

#### Scenario: Setting persists across broadcasts

- **WHEN** the owner changes the switch and a later broadcast starts
- **THEN** the worker applies the changed mode without the owner setting it again

#### Scenario: Default matches immediate enrichment

- **WHEN** an owner has never touched the switch
- **THEN** the switch reads as on and chatters are enriched on their first message
