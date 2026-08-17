## ADDED Requirements

### Requirement: A command carries a credit cost

Each row in the command registry SHALL carry a credit cost, defaulting to zero. A cost of zero SHALL mean
the command is free, which SHALL be the behaviour of every command that does not set one.

The cost SHALL be data on the registry row, editable without a deploy, exactly as the cooldown and the
per-stream limit already are.

The cost SHALL be non-negative. A command SHALL NOT pay a chatter.

#### Scenario: A free command is unaffected

- **GIVEN** a command whose credit cost is zero
- **WHEN** a chatter invokes it
- **THEN** it executes as it does today, and no ledger line is written

#### Scenario: The price is data

- **WHEN** the owner changes a command's credit cost in the registry
- **THEN** the worker charges the new price on its next registry refresh, with no code change or restart

### Requirement: A priced command is charged before it executes

A command whose credit cost is above zero SHALL charge that many credits to the invoking chatter's
membership in the broadcasting community before the command executes.

The charge SHALL be written as a ledger spend, so the balance the ledger reports and the balance cached
on the membership stay in agreement, and so a re-score can rebuild every credit earned without refunding
or confiscating the charge.

The charge SHALL happen after the enabled check, the cooldown check and the per-stream limit check, so a
chatter is never charged for a command that was going to be refused anyway.

A chatter SHALL NOT be charged twice for the same chat message.

#### Scenario: A chatter pays for a command

- **GIVEN** a chatter with credits to spare and a command costing one credit
- **WHEN** they invoke it
- **THEN** one credit is deducted, the command executes, and the execution is logged as it is today

#### Scenario: Refused before charged

- **GIVEN** a priced command that is on cooldown for this chatter
- **WHEN** they invoke it
- **THEN** they are told about the cooldown, nothing is deducted, and the command does not execute

#### Scenario: A disabled priced command

- **GIVEN** a priced command whose registry row is disabled
- **WHEN** a chatter invokes it
- **THEN** nothing is deducted and the attempt is logged as disabled

#### Scenario: The same message is not charged twice

- **GIVEN** a chat message that has already been charged
- **WHEN** the same message is processed again
- **THEN** no second deduction is made

### Requirement: A chatter who cannot afford a command is told

When a chatter's balance cannot cover a command's cost, the command SHALL NOT execute, no credits SHALL
be deducted, and the chatter SHALL be told in chat what the command costs and what they hold.

The refusal SHALL be recorded in the command event log with a status distinguishing it from a cooldown, a
per-stream limit, a disabled command and an unknown one.

#### Scenario: Not enough credits

- **GIVEN** a chatter holding no credits and a command costing one
- **WHEN** they invoke it
- **THEN** the command does not execute, nothing is deducted, and they are told the price and their
  balance

#### Scenario: The refusal is auditable

- **WHEN** a command is refused for an insufficient balance
- **THEN** the event log records it with a status of its own

### Requirement: The host is never charged

A command invoked by the host SHALL NOT be charged, whatever its price, and SHALL execute.

The host owns the community rather than belonging to it and holds no membership in it, so there is no
balance to charge and no ledger line to write.

#### Scenario: The host uses a priced command

- **GIVEN** a command costing one credit
- **WHEN** the host invokes it
- **THEN** it executes, and no ledger line is written

#### Scenario: A chatter with no membership yet

- **GIVEN** a priced command invoked by someone with no membership in this community
- **WHEN** the charge is attempted
- **THEN** the command is refused for an insufficient balance rather than executing free
