## MODIFIED Requirements

### Requirement: Demo switch on the /live page

The system SHALL provide a Demo switch — a shadcn/ui `Switch` — on the Overlays tab rather
than in the `/live` tab bar, off by default. Turning it on SHALL render the overlays on the
Overlays tab from simulated values; turning it off SHALL restore the real current values. A
separate goal-reached switch SHALL sit beside it, setting every demo goal metric to at or
above its target so the reached state can be composed against on demand.

The Overlays tab SHALL also provide a checkbox choosing whether demo values reach OBS as well
as the web app. While the checkbox is off, no demo snapshot SHALL be broadcast and OBS SHALL
continue to render real values. While a broadcast is live and the checkbox is on, the control
SHALL warn plainly that viewers are being shown invented values; it SHALL NOT be blocked.

The demo SHALL make no writes to the stream, chat, scoring, featured, or moderation tables and
SHALL NOT engage the worker or YouTube. The Settings tab SHALL continue to edit and save the
real active stream in both modes, and the enabled state SHALL be ephemeral (off on load).

#### Scenario: Toggle demo on

- **WHEN** the owner turns the Demo switch on
- **THEN** the Overlays tab renders simulated values and no writes are made to real
  stream/chat/scoring data

#### Scenario: Toggle demo off restores real values

- **WHEN** the owner turns the Demo switch off
- **THEN** the overlays return to the real current values, empty where there are none

#### Scenario: Goal-reached state on demand

- **WHEN** the owner turns the goal-reached switch on while demo is on
- **THEN** every demo goal metric sits at or above its target and the overlays render their
  reached state

#### Scenario: Demo stays out of OBS by default

- **WHEN** demo is on and the OBS checkbox is off
- **THEN** the Overlays tab shows demo values while OBS continues to render real values

#### Scenario: Warning when demo would reach viewers

- **WHEN** a broadcast is live and the owner turns the OBS checkbox on
- **THEN** a plain warning states that viewers will see invented values, and the choice is
  still applied

#### Scenario: Settings still edits the real stream during demo

- **WHEN** the owner edits and saves Settings while demo is on
- **THEN** the save targets the real active stream, and those changes are present when
  demo is turned off

### Requirement: Demo toolbar state

While demo is on, the status toolbar SHALL show a Demo indicator. The Go live, End stream and
Discard controls SHALL remain available, because demo is now a property of the Overlays tab
rather than a page-wide mode and a real broadcast may be operated while overlays are being
composed. The Save changes control SHALL remain, still saving the real Settings form.

#### Scenario: Demo is indicated but does not disable the broadcast

- **WHEN** demo is on
- **THEN** the toolbar shows a Demo indicator and the Go live / End / Discard controls stay
  available for the real stream state

#### Scenario: Indicator clears when demo is off

- **WHEN** demo is turned off
- **THEN** the Demo indicator is removed and the toolbar shows the real status alone

### Requirement: Simulated activity

The Activity tab SHALL carry its own demo toggle, independent of the Overlays tab's Demo
switch. Turning it on SHALL render the simulated activity feed and indicators; turning it off
SHALL restore the real activity for the active stream. The toggle SHALL be off on load and
SHALL make no writes to real data.

#### Scenario: Activity demo is independent

- **WHEN** the owner turns demo on for the Overlays tab
- **THEN** the Activity tab continues to show real activity until its own toggle is turned on

#### Scenario: Activity demo renders the simulated feed

- **WHEN** the owner turns the Activity tab's demo toggle on
- **THEN** the simulated activity feed and indicators render, and no writes are made to real
  chat, scoring or moderation data

### Requirement: Per-tab pop-out

The system SHALL show the pop-out icon in the tab bar only when the active tab is Preview
or Activity, and it SHALL pop out that tab's content — the preview player for Preview, the
Activity panel for Activity. The pop-out icon SHALL NOT appear on the Settings or Overlays
tabs, and pop-out SHALL be unavailable while that tab's demo is on.

#### Scenario: Pop-out follows the active tab

- **WHEN** the owner is on the Preview tab and clicks pop-out
- **THEN** a window opens rendering the preview player; on the Activity tab it renders the
  Activity panel

#### Scenario: No pop-out on Settings or Overlays

- **WHEN** the owner is on the Settings tab or the Overlays tab
- **THEN** no pop-out icon is shown

## REMOVED Requirements

### Requirement: Overlay-feed parity on the demo stage

**Reason**: The demo stage no longer has its own reimplementation of the overlays to keep in
step. A single overlay renderer serves the OBS route and the Overlays tab, so parity is
structural and cannot drift. The behaviour this requirement protected — one slot at a time,
the demo-only placeholder, the Play buttons and the persist checkbox — is retained by the
overlay control panel and the shared renderer.

**Migration**: The Play buttons, persist checkboxes and visibility toggles move to the
Overlays tab's control panel unchanged. The demo-only dashed placeholder is rendered by the
shared renderer when it is told it is on the Overlays tab, and never on the OBS route.
