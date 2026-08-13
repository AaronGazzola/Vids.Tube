## Context

The Settings tab holds a form built from the active broadcast and saved as a whole by Save
changes. Every field follows that rule except the thumbnail, which uploads to storage and
writes `thumbnail_path` the moment a file is chosen, and which refuses to run unless the most
recent broadcast is in preview or live.

Because the upload writes to the broadcast, the settings query refetches and the form resyncs
from the database, discarding anything the owner had typed and not yet saved. The reported
symptom — "uploading a thumbnail resets the other settings" — is that resync.

## Goals / Non-Goals

**Goals:**

- One button that makes a new broadcast inherit a previous one.
- The thumbnail behaves like every other field: staged, previewed, saved on Save changes.
- Nothing is written by opening, browsing or choosing in the dialog.

**Non-Goals:**

- Templates or presets as a stored concept. Reuse copies from a real past broadcast.
- Editing a past broadcast from the dialog.
- Changing how Save changes itself works.

## Decisions

### The dialog fills the form, and only the form

Choosing a broadcast calls the same `setForm` the fields use, so the reuse path and typing by
hand converge immediately. Save changes is then the only writer, and cancelling costs nothing
because nothing was written.

*Alternative considered:* copy server-side into the active broadcast on selection. Rejected: it
writes before the owner has seen the result, and reintroduces the resync that loses unsaved
edits.

### The YouTube URL and the schedule are excluded, and said so in the dialog

Both identify a specific past broadcast. Copying the video URL would point a new broadcast at
the old video and, worse, at its chat. The dialog states what is not copied rather than
silently dropping two fields.

### The thumbnail is staged as a file, uploaded on save

Selecting a file keeps it in form state and shows it through a local object URL. Save changes
uploads it and writes the resulting key with the rest of the settings.

This means an abandoned selection never reaches storage, which is what makes cancelling free.
It also removes the encoder gate: nothing about a thumbnail needs a running encoder, and the
gate existed only because the upload targeted whichever broadcast happened to be current.

A thumbnail reused from a past broadcast is a key that already exists in storage, so it is
copied by reference rather than re-uploaded, and the past broadcast keeps its own.

*Alternative considered:* upload immediately to a scratch location and move it on save.
Rejected as more moving parts for the same result, and it can still orphan objects.

### Listing is a query, not a new table

Ended broadcasts already carry title and `thumbnail_path`. The list reads those directly,
newest first, with a bounded limit, so nothing new is stored to support the feature.

## Risks / Trade-offs

- [A reused thumbnail key is shared by two broadcasts, so deleting one could break the other] →
  Deletion is not part of this change, and the existing retention path already treats stored
  objects as immutable. Worth stating in the spec so a future cleanup does not delete by
  broadcast.
- [Staging a file in form state means a large object sits in memory until save] → The existing
  5 MB limit is enforced at selection rather than only at upload, so the ceiling is unchanged.
- [Removing the encoder gate lets a thumbnail be set on a broadcast that does not exist yet] →
  Save changes already creates or updates the broadcast, so the thumbnail is written with it.
