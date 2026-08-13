# stream-settings-reuse Specification

## Purpose
TBD - created by archiving change reuse-stream-settings. Update Purpose after archive.
## Requirements
### Requirement: Reuse settings from a previous broadcast

The Settings tab SHALL provide a "Reuse stream settings" control at the top of the tab, which
opens a dialog listing previous broadcasts for selection. The control SHALL be disabled while a
broadcast is live, since replacing the settings of a running broadcast is never wanted.

#### Scenario: Opening the dialog

- **WHEN** the owner clicks "Reuse stream settings" with no broadcast live
- **THEN** a dialog opens listing previous broadcasts

#### Scenario: Disabled while live

- **WHEN** a broadcast is live
- **THEN** the "Reuse stream settings" control is disabled and the dialog cannot be opened

### Requirement: Only ended broadcasts are offered

The dialog SHALL list only broadcasts whose status is ended, newest first, each shown with its
thumbnail and its title. A broadcast with no thumbnail SHALL still be listed, with a placeholder
in place of the image.

#### Scenario: Draft and live broadcasts are absent

- **WHEN** the owner has a draft broadcast and a previously ended one
- **THEN** only the ended broadcast appears in the list

#### Scenario: A broadcast without a thumbnail is still offered

- **WHEN** an ended broadcast has no thumbnail
- **THEN** it appears in the list with its title and a placeholder image

### Requirement: Selection fills the form and writes nothing

Choosing a broadcast SHALL fill the Settings form from that broadcast and close the dialog. No
value SHALL be written to any broadcast, to storage, or to the database until the owner clicks
Save changes.

Every setting SHALL be copied except the YouTube video URL and the scheduled start time, both
of which identify the broadcast being copied from. The dialog SHALL state that those two are
not copied.

#### Scenario: The form is filled

- **WHEN** the owner selects a previous broadcast
- **THEN** the title, description, goals, thumbnail and every bot, scoring, wrap-up and command
  setting in the form match that broadcast

#### Scenario: The URL and schedule are left alone

- **WHEN** the owner selects a previous broadcast
- **THEN** the YouTube video URL and the scheduled start time in the form are unchanged

#### Scenario: Cancelling costs nothing

- **WHEN** the owner selects a previous broadcast and then reloads without saving
- **THEN** the active broadcast is exactly as it was before the dialog was opened

#### Scenario: Saving applies the reused settings

- **WHEN** the owner selects a previous broadcast and clicks Save changes
- **THEN** the active broadcast carries those settings, including the thumbnail

### Requirement: A reused thumbnail is shared, not copied

Reusing a broadcast's thumbnail SHALL reference the existing stored object rather than
uploading a second copy. The broadcast it came from SHALL keep its own thumbnail unchanged.

#### Scenario: The original keeps its thumbnail

- **WHEN** the owner reuses a previous broadcast's settings and saves
- **THEN** both broadcasts show that thumbnail, and the previous broadcast is otherwise
  unchanged

