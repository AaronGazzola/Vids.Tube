## ADDED Requirements

### Requirement: Unified owner stream-management page

The system SHALL serve a single owner-only page at `/live` that manages the channel's
one active stream and derives its state from the stream `status`
(`none`/`draft`/`scheduled`/`preview`/`live`). It SHALL present three tabs — Settings,
Preview, Activity — plus a status toolbar fixed across all tabs. Non-owners SHALL NOT
access it.

#### Scenario: Owner opens the management page

- **WHEN** the owner opens `/live`
- **THEN** the page resolves the single active stream, selects state from its status,
  and shows the Settings/Preview/Activity tabs and the status toolbar

#### Scenario: No active stream

- **WHEN** the owner opens `/live` with no active stream
- **THEN** the Settings tab lets them configure a draft or schedule a broadcast, and
  the toolbar's Go live / End are disabled

#### Scenario: Non-owner blocked

- **WHEN** a non-owner or anonymous user requests `/live`
- **THEN** access is denied (redirect), consistent with owner gating

### Requirement: Settings tab

The system SHALL provide a Settings tab editing the active stream as one form:
broadcast details (title, description, thumbnail, and a schedule datetime disabled
once the stream is public/live); connection (stream key + RTMP URL + regenerate);
the YouTube stream URL; goals; overlays (copy URLs + dimensions); mod bot switches;
the waiting-room chat toggle; and a worker reminder. The Settings content SHALL be
laid out in a **single column**. All editable settings — including goal targets and
the mod bot switches — SHALL be persisted **only** by the toolbar Save changes
action; there SHALL be no per-section save buttons (no "Save targets", no "Start"/
"Restart").

#### Scenario: Single-column layout

- **WHEN** the owner opens the Settings tab
- **THEN** its sections are stacked in one column, not split across two columns

#### Scenario: One save path

- **WHEN** the owner edits any settings field, including goal targets or a switch
- **THEN** the change is pending until Save changes is pressed; there is no separate
  per-section save control

#### Scenario: Schedule datetime disabled when public

- **WHEN** the stream is `live` (or otherwise public)
- **THEN** the schedule datetime field is disabled

#### Scenario: Fields edit the active stream on save

- **WHEN** the owner edits Settings fields and saves
- **THEN** the active stream row is updated (or created as draft/scheduled if none),
  and the overlay renderers reflect the saved settings

### Requirement: Goals model

The system SHALL express stream goals as three targets on the active stream. Subs
progress SHALL be a delta from a baseline captured automatically when the stream
becomes `scheduled`, or at go-live if it was never scheduled, with no manual start.
Likes and viewers SHALL be absolute current values fed from YouTube, with no baseline
and no start control. There SHALL be no "Save targets", "Start", or "Restart"
button: the three target numbers save with the toolbar Save changes action, and
progress restarts automatically when the broadcast is scheduled or goes live (the
baseline is recaptured at that moment).

#### Scenario: No goal action buttons

- **WHEN** the owner edits the goal targets
- **THEN** there is no Save-targets, Start, or Restart button; the targets persist on
  Save changes and the subs baseline is (re)captured on schedule/go-live

#### Scenario: Subs baseline auto-set

- **WHEN** a broadcast is scheduled (or goes live without having been scheduled)
- **THEN** the subs baseline is captured at that moment and subs progress renders as
  current minus baseline toward the target

#### Scenario: Likes and viewers are absolute

- **WHEN** likes/viewers goals are configured
- **THEN** their progress uses absolute YouTube values with no baseline or start action

### Requirement: Overlay copy always available

The system SHALL let the owner copy each overlay's OBS browser-source URL and its
dimensions from the Settings tab regardless of stream state — Highlights, Goal subs,
Goal likes, Goal viewers, and Competition — plus a competition opacity control that
adjusts the competition URL.

#### Scenario: Copy overlay URLs with no active stream

- **WHEN** the owner opens Settings with no active stream
- **THEN** every overlay URL and its dimensions are shown and copyable

#### Scenario: Competition opacity

- **WHEN** the owner adjusts competition opacity
- **THEN** the copied competition URL encodes the chosen opacity

### Requirement: Mod bot switches

The system SHALL present mod bot controls in Settings: auto-hide shown as always on
(not toggleable); a ban-mode switch (auto-ban vs suggest); a chat-scoring on/off
switch; a featured-highlighting on/off switch; and an auto-display-featured switch
that is disabled when featured highlighting is off. Every one of these controls
SHALL be rendered as a shadcn/ui `Switch` component, not a toggle button, radio
group, or link-styled control.

#### Scenario: Controls are shadcn switches

- **WHEN** the owner views the mod bot controls (and the waiting-room chat toggle)
- **THEN** each is a shadcn/ui `Switch`, not a toggle button

#### Scenario: Ban mode toggled

- **WHEN** the owner switches ban mode between auto-ban and suggest
- **THEN** the modbot applies bans automatically or only suggests them accordingly

#### Scenario: Auto-display disabled without highlighting

- **WHEN** featured highlighting is off
- **THEN** the auto-display-featured switch is disabled

### Requirement: Worker reminder

The system SHALL show, in Settings, the copy-paste command to start the local worker
and a running/stopped indicator derived from the worker heartbeat.

#### Scenario: Worker running indicator

- **WHEN** the worker heartbeat is fresh
- **THEN** the reminder shows the worker as running; otherwise it shows stopped with
  the command to start it

### Requirement: Preview tab

The system SHALL provide a Preview tab with the video player — the private preview HLS
while `preview` and the public HLS while `live` — and, below it, the live
transcription in an auto-scrolling component that populates only while `live`.

#### Scenario: Private preview then public

- **WHEN** the stream is `preview`
- **THEN** the player shows the private preview feed and no transcript appears until
  the stream is `live`

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

### Requirement: Live chat message affordances

The system SHALL render each Activity live-chat message with: a three-dot menu with
**Highlight on overlay** (manually promote any message to the highlight overlay, even
one the bot never featured), **Hide message**, and **Ban** (which SHALL require a
confirmation dialog before banning); the menu SHALL be present on every non-hidden
message, including already-highlighted ones. A hidden state (by owner or bot) SHALL
collapse to a thin row that opens a popover with Reveal, and when revealed show hidden
styling plus Hide (recollapse) and Unhide (publish back to chat). A feature-suggested
state SHALL use prominent highlight styling with Highlight (promote to overlay),
Dismiss, and an **info button that opens a popover with the bot's reason**, dropping
to a secondary distinct styling once highlighted or dismissed. When scored, a message
SHALL show a score badge that opens a popover with the bot's reasoning.

#### Scenario: Manually highlight any message

- **WHEN** the owner picks Highlight on overlay from a message's three-dot menu
- **THEN** that message is promoted to the highlight overlay even if the bot never
  featured it

#### Scenario: Ban asks for confirmation

- **WHEN** the owner picks Ban from a message's three-dot menu
- **THEN** a confirmation dialog is shown with a checkbox (default checked) to hide
  all of that participant's past messages in the stream, and the user is banned only
  on confirm — hiding their past messages when the checkbox is checked

### Requirement: Banned users management

The system SHALL provide, on the owner's Account page, a Banned users list showing
everyone blocked from chatting on the channel (channel-wide, across all streams),
each with an Unban control that removes the ban. Non-owners SHALL NOT see it.

#### Scenario: Review and unban from the account page

- **WHEN** the owner opens the Account page
- **THEN** a Banned users list shows each banned participant with an Unban button,
  and unbanning removes them from the channel's ban list

#### Scenario: Empty ban list

- **WHEN** no one is banned on the channel
- **THEN** the Banned users list shows an empty state rather than being hidden

#### Scenario: Hide, reveal, unhide a message

- **WHEN** the owner hides a message, then reveals it, then unhides it
- **THEN** it collapses to a thin row, reveals with hidden styling on demand, and
  returns to the public chat on unhide

#### Scenario: Highlight or dismiss a suggested message

- **WHEN** the bot suggests a message and the owner clicks Highlight or Dismiss
- **THEN** it is shown on the overlay (Highlight) or dropped, and its styling changes
  from prominent to secondary

#### Scenario: Inspect a score

- **WHEN** the owner clicks a message's score badge
- **THEN** a popover shows the bot's reasoning for the score

### Requirement: Mod bot actions component

The system SHALL provide a collapsible mod bot actions component (collapsed by
default) with Hidden and Banned tabs each showing a counter; expanded, it lists
suggested and auto-enacted cases with the original message and reasoning plus
Unhide/Unban controls.

#### Scenario: Review and reverse actions

- **WHEN** the owner expands the mod bot actions component
- **THEN** the Hidden and Banned tabs list suggested and auto-enacted cases with
  original message, reasoning, and Unhide/Unban buttons

### Requirement: Status toolbar

The system SHALL render a status toolbar fixed across all tabs: the stream status on
the left; a red Go live / End stream button next to it (disabled unless `preview` or
`live`); Discard available in `draft`/`scheduled`/`preview`; the view count when
`live` or the waiting count when `scheduled`; and a Save changes button on the right,
disabled when the form state equals the DB. Go live, End stream, and Discard SHALL
each require a confirmation dialog. The tab bar (Settings/Preview/Activity) SHALL be
pinned at the **top** of the page and the status toolbar pinned at the **bottom**,
both staying in place across all tabs while the tab content scrolls between them.

#### Scenario: Tabs top, toolbar bottom

- **WHEN** the owner scrolls a tab's content
- **THEN** the tab bar stays fixed at the top and the status toolbar stays fixed at
  the bottom

#### Scenario: Go live and end require confirmation

- **WHEN** the owner presses Go live or End stream
- **THEN** a confirmation dialog is shown before the action is applied

#### Scenario: Discard in preview confirmation

- **WHEN** the owner presses Discard while `preview`
- **THEN** the confirmation explains a blank private preview will remain while the
  encoder is connected

#### Scenario: Save disabled when unchanged

- **WHEN** the Settings form state equals the DB
- **THEN** Save changes is disabled

#### Scenario: Count reflects state

- **WHEN** the stream is `live`
- **THEN** the toolbar shows the view count; when `scheduled` it shows the waiting count
