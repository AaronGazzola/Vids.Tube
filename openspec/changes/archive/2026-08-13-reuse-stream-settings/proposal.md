## Why

Setting up a broadcast means retyping the same two dozen fields every time: title, description,
goals, the mod bot switches, the scoring and wrap-up toggles, the disabled commands, and a
thumbnail. Every broadcast is a near copy of the last one, and nothing carries across.

The thumbnail is worse than merely manual. It cannot be set at all until the encoder is
connected, so the one asset that should be prepared in advance is the one that can only be
chosen at the last moment. Uploading it also writes straight to the broadcast rather than
waiting for Save changes, so any unsaved edits in the rest of the form are lost when the page
resyncs.

## What Changes

- A "Reuse stream settings" button sits at the top of the Settings tab and opens a dialog
  listing previous broadcasts, each shown with its thumbnail and title, newest first.
  - Only broadcasts that have ended are listed.
  - The button is disabled while a broadcast is live.
- Choosing a broadcast fills the Settings form from it, including the thumbnail. Nothing is
  written until Save changes is clicked, so a mistaken choice costs nothing.
- Everything is copied except the YouTube video URL and the scheduled start time, both of which
  identify the old broadcast and would be wrong on a new one.
- **BREAKING** The thumbnail is no longer uploaded and saved on selection. Choosing a file
  stages it in the form, shows it immediately, and it is stored when Save changes is clicked
  along with everything else.
- The thumbnail no longer requires a connected encoder. It can be chosen at any point in a
  broadcast's life, including before one exists.

## Capabilities

### New Capabilities
- `stream-settings-reuse`: listing previous ended broadcasts, presenting them for selection,
  and filling the settings form from one without writing anything.

### Modified Capabilities
- `broadcast-setup`: the thumbnail becomes an ordinary form field, staged and saved with the
  rest rather than uploaded on selection, and no longer gated on the encoder being connected.

## Impact

- `app/(app)/live/settings-tab.tsx`: the reuse button and dialog, and the thumbnail field.
- `app/(app)/live/broadcast.actions.ts`: a query listing ended broadcasts with their thumbnail
  and title; the thumbnail upload loses its encoder gate and its direct write, becoming part of
  the settings save.
- `app/(app)/live/broadcast.hooks.tsx`: a hook for the list, and the changed thumbnail
  mutation.
- Storage: a staged thumbnail must be uploaded on save, so an abandoned selection never leaves
  an orphan object.
