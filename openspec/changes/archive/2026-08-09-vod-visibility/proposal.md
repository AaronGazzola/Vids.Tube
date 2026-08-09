## Why

A recording has no visibility setting. Hiding one is done by marking it a
processing failure, which is how the 8-Aug-2026 broadcast is hidden today. A
recording that genuinely failed to process and one deliberately withheld are now
the same row, so nothing can tell them apart and the reaper cannot be trusted to
leave either alone.

Visibility is also a prerequisite rather than a convenience. Replacing that
broadcast's file, and later editing any published recording, both need somewhere
to put a recording while it is being worked on. Private is that place.

## What Changes

- A `visibility` setting on every recording: `public`, `unlisted` or `private`,
  matching YouTube, and held separately from processing state.
  - **Public**: listed on the channel and reachable by anyone.
  - **Unlisted**: not listed anywhere, reachable only by its own address.
  - **Private**: reachable only by the channel owner.
- Enforcement in the database read policy rather than in the page, so an
  unlisted recording cannot be found by listing and a private one cannot be
  fetched by guessing an address.
- A private recording answers not-found rather than forbidden, so its existence
  is not disclosed.
- Owner control from the studio, on the recording itself.
- Every recording defaults to `public`, so nothing about current behaviour
  changes.
- The 8-Aug-2026 recording becomes `private` and has its processing state
  corrected from `failed` back to `ready`, since it is marked failed only in
  order to hide it.

## Capabilities

### New Capabilities
- `vod-visibility`: the three visibility states, who can reach a recording in
  each, how the setting is enforced, and how it is changed.

### Modified Capabilities
- `vod-playback`: a recording is now reachable subject to visibility, where
  previously every ready recording was public.

## Impact

- Adds a column and replaces the read policy on recordings.
- Touches the channel listing, the watch page and the studio.
- No change to recording, finalizing or uploading. Visibility is a catalogue
  concern, and the file in storage is untouched.
- AZ-241 is the tracking issue. AZ-239 depends on this.
