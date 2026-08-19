## MODIFIED Requirements

### Requirement: Activity tab

The system SHALL provide an Activity tab, in top-to-bottom order: a header
(subs/likes/viewers goal progress and a collapsible competition), then the mod bot
actions component, then the live chat. Collapsed, the competition SHALL show the top
three chatters as **badge components** laid out left-to-right from highest to lowest
rank, each badge showing rank, avatar, handle, and score; expanded, it SHALL show a
**vertical list** of the full rankings (rank, avatar, handle, score), with no ban
controls. The whole Activity tab SHALL be poppable into its own window.

The Activity tab SHALL fit within the page between the tab bar and the status
toolbar without scrolling the page: the header, competition, and mod bot actions
sit at their natural heights, and only the **live chat** scrolls. The chat SHALL
have a minimum height of 250px and otherwise grow to fill the space remaining below
the components above it and above the toolbar.

The pop-out control SHALL be an **icon-only button in the tab bar** (right side, no
label), and the pop-out window SHALL render the **exact same** Activity content
(header, competition, mod bot actions, chat) as the tab.

The Activity tab SHALL carry a **second icon-only pop-out control**, beside the first,
opening the roster of everyone who has spoken in the broadcast. The two controls SHALL
be distinguishable by icon and by accessible label. The roster control SHALL appear only
on the Activity tab, SHALL be unavailable while the Activity demo is on, and SHALL open
a window distinct from the Activity panel's, so both can be open at once on separate
monitors.

The roster SHALL NOT be rendered inside the Activity tab, so the heights above are
unchanged and the chat keeps the space it is given.

#### Scenario: Competition collapsed shows three badges

- **WHEN** the competition is collapsed
- **THEN** the top three chatters appear as badges left-to-right highest-to-lowest,
  each with rank, avatar, handle, and score

#### Scenario: Competition expanded shows the full ranking

- **WHEN** the owner expands the competition
- **THEN** it shows a vertical list of the full rankings with no ban controls

#### Scenario: Mod bot actions above chat

- **WHEN** the owner views the Activity tab
- **THEN** the mod bot actions component is above the live chat

#### Scenario: Only the chat scrolls

- **WHEN** the Activity tab content exceeds the space between tabs and toolbar
- **THEN** the page does not scroll; the chat (min 250px) fills the remaining space
  and scrolls internally

#### Scenario: Pop out the activity tab

- **WHEN** the owner clicks the icon-only pop-out button in the tab bar
- **THEN** a separate window opens rendering the identical Activity content (header,
  competition, mod bot actions, chat)

#### Scenario: Pop out the roster

- **WHEN** the owner clicks the roster pop-out button on the Activity tab
- **THEN** a separate window opens rendering the roster, leaving any open Activity
  pop-out window as it was

#### Scenario: The roster control is absent elsewhere

- **WHEN** the owner is on the Settings, Preview or Overlays tab, or the Activity demo
  is on
- **THEN** no roster pop-out control is shown

#### Scenario: The tab keeps its height

- **WHEN** the Activity tab is shown
- **THEN** no roster is drawn within it, and the chat fills the same space as before
