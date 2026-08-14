## RENAMED Requirements

- FROM: `### Requirement: The member count belongs to the first message`
- TO: `### Requirement: A metric belongs to the message that carries it`

## MODIFIED Requirements

### Requirement: A metric belongs to the message that carries it

The message banner SHALL show a metric alongside a message only when that message carries one.
While a message carrying no metric is showing, the message SHALL take the full width of the
banner. The number SHALL be the current one each time it is shown, not the value from a previous
cycle.

The member count is one such metric rather than a fixed feature of the first message.

#### Scenario: A message without a metric takes the full width

- **WHEN** the banner is showing a message that carries no metric
- **THEN** no number is shown and the message occupies the full width of the banner

#### Scenario: A metric returns with its message

- **WHEN** the cycle returns to a message carrying a metric
- **THEN** that number is shown beside it again, carrying the current figure rather than the
  figure from the previous cycle

#### Scenario: Existing layouts keep their count

- **WHEN** a layout saved before metrics existed is loaded
- **THEN** its first message carries the member count with the Vids.Tube logo, exactly as the
  banner rendered before
