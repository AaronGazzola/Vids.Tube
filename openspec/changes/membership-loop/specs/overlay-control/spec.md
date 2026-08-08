## ADDED Requirements

### Requirement: The opacity control fades the backing, never the text

The per-overlay opacity control SHALL scale the alpha of the black backing an overlay surface sits on, and SHALL NOT change the opacity of the surface itself. Text, avatars and progress rings SHALL stay fully opaque at every setting.

Fading the whole element took the words with it, so any setting subtle enough to be unobtrusive was also too faint to read. The control exists to let the broadcast show through the backing, not to make the overlay illegible.

Each surface MAY declare its own base alpha; the control SHALL multiply whatever that base is, so a control at its maximum leaves every surface looking exactly as it did before.

#### Scenario: Lowering the control fades only the backing

- **WHEN** the control for a surface is moved from its maximum to a fifth
- **THEN** the backing's alpha falls in proportion, and the surface's own opacity is unchanged

#### Scenario: Text stays readable at the lowest setting

- **WHEN** a surface is set to its lowest opacity
- **THEN** its text renders at full opacity

#### Scenario: The maximum setting preserves the existing look

- **WHEN** the control is at its maximum
- **THEN** each surface's backing shows its own base alpha, unchanged from before the control was introduced
