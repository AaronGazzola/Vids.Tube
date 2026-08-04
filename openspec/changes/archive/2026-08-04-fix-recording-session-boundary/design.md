## Context

MediaMTX records with `recordPath: /var/lib/vids-tube/rec/%path/%Y-%m-%d_%H-%M-%S-%f`, so every segment's filename carries the moment MediaMTX began writing it, to sub-second precision. One file is written per publish session, so a broadcast that disconnects and reconnects leaves several.

`runOnNotReady` fires the finalize hook. It concatenates the segments, uploads the result, and calls the app's recording hook. It asks the app for the broadcast's bounds, and the app already answers with both `startedAt` (encoder connect) and `liveAt` (go-live).

The hook currently derives the session start with `stat -c %W`, falling back to `%Y`. Neither is the start: `%W` is unsupported on this filesystem and returns 0, and `%Y` is the last write, which is the end.

## Goals / Non-Goals

**Goals:**

- A finalized VOD starts at go-live.
- A finalize only ever includes segments from the broadcast being finalized.
- Segments left by an earlier broadcast are removed rather than absorbed, whether or not that broadcast was ever marked ended.

**Non-Goals:**

- Changing how reconnects are handled. Several segments within one broadcast are still concatenated into one VOD with jump cuts.
- Changing the app's bounds endpoint, which already returns everything needed.
- Re-cutting the existing VODs. The three broadcasts affected were replaced by their YouTube copies.

## Decisions

### The start time comes from the filename

Each segment's start is parsed from its own name. The filesystem is not consulted for timing at all.

This is the only source that is actually the start. It is also more precise than the second-resolution alternatives, and it survives a file being copied or touched.

A segment whose name does not parse is skipped with a logged warning rather than silently given a wrong time, because a wrong time is what caused this.

### The current broadcast is identified from its newest segment

The hook asks the app for bounds using the newest segment's start time, not the oldest.

The newest segment always belongs to the session being finalized. The oldest may belong to a broadcast that ended days ago, which is exactly how the wrong broadcast's bounds were fetched before.

### Segments are partitioned against the broadcast's own start

With `startedAt` in hand, segments are split into those at or after it and those before. The first group is the broadcast. The second is debris.

A small tolerance is allowed on the boundary, because MediaMTX begins writing a moment before the app records the encoder as connected. Without it the broadcast's own first segment could be classified as debris, which would discard real footage.

### Debris is deleted on every finalize

Segments predating the current broadcast are removed as soon as they are identified, regardless of whether the broadcast they came from was ever marked ended.

The existing rule — delete only once ended — is kept for the current broadcast's own segments, because a reconnect re-finalizes and needs them. But that rule is what let an unended broadcast leave its footage lying around, so it is no longer the only path to deletion.

## Risks / Trade-offs

- **A clock difference between MediaMTX and the app could misclassify the first segment** → The boundary tolerance covers it. The tolerance is generous relative to the gap it corrects and small relative to the gap between two broadcasts.
- **Deleting debris destroys footage if the partition is wrong** → Debris is only ever deleted after the current broadcast's segments have been identified and concatenated successfully, so a failure aborts before anything is removed.
- **A broadcast recorded before this change has no parseable name** → Names have always carried the timestamp; only the reading of it is new.
- **The trim needs a keyframe-safe remux of the first segment** → Already the case today, and unchanged: the first segment is remuxed, later ones are copied.
