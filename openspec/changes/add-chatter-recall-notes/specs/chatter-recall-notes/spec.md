## ADDED Requirements

### Requirement: Every chatter in a broadcast carries private remembering points

The system SHALL store, per membership, a short list of points that help the channel owner recognise
that person and continue their last conversation.

Each point SHALL be one of two kinds, and SHALL record which:

- **Standing** — something durable about the person: what they study, what work they do, a project or
  interest they have raised more than once.
- **Check-in** — something with a shelf life that invites a question next time: an illness, an exam, a
  trip, a birthday, a decision they were weighing.

Every point SHALL carry the date the point was raised in chat, so its age is known without reading the
chat it came from.

A check-in point whose raised date is more than 60 days old SHALL be dropped when the notes are next
written, rather than kept and shown stale.

The stored list SHALL hold at most 8 points, of which at most 3 SHALL be check-ins. Where more are
produced, the most recently raised SHALL be kept.

#### Scenario: A conversation leaves a check-in behind

- **GIVEN** a chatter who said during a broadcast that they have an exam next week
- **WHEN** the notes for that broadcast are written
- **THEN** their notes carry a check-in point about the exam, dated to that broadcast

#### Scenario: A stale check-in is dropped

- **GIVEN** a check-in point raised more than 60 days ago
- **WHEN** the notes are next written
- **THEN** that point is no longer stored

#### Scenario: The list stays short

- **WHEN** more points are produced than the list holds
- **THEN** the most recently raised are kept and the rest are discarded

### Requirement: Notes are written after a broadcast, never while one runs

Notes SHALL be written only by the post-broadcast pass. No note SHALL be generated in response to a
chatter speaking, opening a panel, or any other request made during a broadcast.

Only memberships whose chatter spoke in the broadcast being settled SHALL be considered. A member who
did not speak SHALL keep whatever notes they already have.

The host SHALL be excluded, holding no membership in their own community. Software identities SHALL be
excluded.

#### Scenario: Notes are ready before the next broadcast

- **GIVEN** a chatter who spoke in a broadcast
- **WHEN** the post-broadcast pass has run for that broadcast
- **THEN** their notes are stored, and the next broadcast reads them without generating anything

#### Scenario: Nothing is generated on arrival

- **WHEN** a chatter speaks during a live broadcast
- **THEN** no note generation is triggered

#### Scenario: A quiet member is left alone

- **GIVEN** a member who did not speak in the broadcast being settled
- **THEN** their existing notes are neither rewritten nor cleared

### Requirement: A chatter who said nothing new is skipped

The stored notes SHALL carry a snapshot of the message count and broadcasts attended they were
generated from.

A membership whose snapshot is unchanged SHALL be skipped without invoking the model. This SHALL use
the same regeneration test already applied to the cached `!me` profile, rather than a second rule.

A run SHALL invoke the model at most 40 times per broadcast. Where more memberships qualify, those who
sent the most messages in that broadcast SHALL be written first, and the number left unwritten SHALL be
reported so a cap is never silent.

#### Scenario: An unchanged chatter costs nothing

- **GIVEN** a chatter whose message count and attendance are unchanged since their notes were written
- **WHEN** the notes step runs
- **THEN** they are skipped and no model call is made for them

#### Scenario: A capped run says so

- **GIVEN** more qualifying memberships than the per-broadcast cap allows
- **WHEN** the notes step runs
- **THEN** the busiest chatters are written and the number left unwritten is reported

### Requirement: Notes are generated from what was said and what was being discussed

Generation SHALL read the chatter's own messages in the broadcast being settled, across both chat
origins, bounded to their 20 most recent messages in that broadcast.

For each of those messages, the transcript of what was being said on the broadcast within 30 seconds
either side SHALL be supplied alongside it, so a reply reads as part of a conversation rather than as an
isolated line.

The chatter's existing notes SHALL be supplied, so a point already known is carried forward or updated
rather than duplicated.

Nothing beyond these inputs SHALL be supplied, and no point SHALL be recorded that is not supported by
one of them.

#### Scenario: A reply is read in context

- **GIVEN** a chatter whose message is an answer to a question asked aloud on the broadcast
- **WHEN** their notes are written
- **THEN** the transcript around that message is available to the generation, so the answer is
  understood as an answer

#### Scenario: A known point is not duplicated

- **GIVEN** a chatter whose notes already record what they study
- **WHEN** they mention their studies again
- **THEN** the existing point is carried forward or updated, and a second point saying the same thing
  is not added

### Requirement: Notes are readable only by the channel owner

Notes SHALL be readable only by the owner of the community channel the membership belongs to, enforced
by a row-level security policy rather than by a check inside any one function.

No policy SHALL permit insert, update or delete, so writes remain with the worker.

Notes SHALL NOT be rendered on any public page, SHALL NOT be sent to chat, and SHALL NOT be shown to
the member they describe.

Notes SHALL be deleted when the membership they belong to is deleted.

#### Scenario: A chatter cannot read their own notes

- **WHEN** a signed-in member requests the notes stored against their own membership
- **THEN** no rows are returned

#### Scenario: Another channel's owner cannot read them

- **WHEN** the owner of a different community requests a membership's notes
- **THEN** no rows are returned

#### Scenario: Notes follow their membership

- **WHEN** a membership is deleted
- **THEN** its notes are deleted with it
