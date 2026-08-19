## ADDED Requirements

### Requirement: Sound collision keeps one surviving sound

A merge SHALL leave `chatter_sounds` keyed on the identity channel rather than
re-keying it, because a sound is held against the identity channel and not
against a participant key, and MUST therefore never orphan a sound.

Where the source identity and the survivor each hold a sound record in the same
community, the merge SHALL keep one record and delete the other, choosing an
approved member sound over an unapproved one, and where both are approved or
both unapproved, the more recently uploaded one. The survivor's mute flag SHALL
be kept, so a mute is not lifted by a merge.

#### Scenario: An approved sound survives an unapproved one

- **WHEN** both identities hold a sound in the same community and only the source's is approved
- **THEN** the source's sound is what remains on the survivor

#### Scenario: The more recent upload survives when both are approved

- **WHEN** both identities hold an approved sound in the same community
- **THEN** the more recently uploaded sound is what remains

#### Scenario: A mute survives the merge

- **WHEN** the survivor's sound was muted before the merge
- **THEN** the surviving record is still muted afterwards

#### Scenario: A sound is not lost when only one identity has one

- **WHEN** only the source identity holds a sound in a community
- **THEN** that sound is held by the survivor after the merge
