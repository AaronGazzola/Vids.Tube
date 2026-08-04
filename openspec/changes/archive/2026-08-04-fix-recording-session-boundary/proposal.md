## Why

The recording finalize step has never trimmed pre-live footage, and it cannot tell one broadcast's segments from another's. Both faults come from the same place: it asks the filesystem when a recording started, and the filesystem does not know.

`stat -c %W` (birth time) is unsupported on the VM's filesystem, so the script falls back to `%Y`, which is the last-write time. That is the *end* of a recording, not the start, so the computed trim is always negative and always discarded. Every broadcast therefore starts at encoder connect rather than go-live: 38 minutes of pre-live footage on 26-Jul-2026, 15 minutes on 28-Jul-2026.

The same wrong timestamp picks the segment list. `ls -tr` takes every file in the recording directory, so segments left behind by an earlier broadcast are concatenated onto the front of the next one. Segments are only deleted when a broadcast is marked ended, and the 28-Jul-2026 broadcast sat unended for three days, leaving its footage in place for the next stream to absorb.

MediaMTX already writes the true start time into every filename. Nothing reads it.

## What Changes

- The session start of each segment is read from its filename rather than from the filesystem.
- The current broadcast is identified from its newest segment, which always belongs to the session being finalized, rather than from the oldest file present.
- Only segments belonging to the current broadcast are concatenated. Segments predating it are removed rather than absorbed.
- Pre-live footage is trimmed, because the trim is now computed from a start time that is actually the start.
- Segments are deleted once the broadcast has ended, as now, and stale segments are deleted whenever a finalize runs, so an unended broadcast cannot poison the next one.

## Capabilities

### Modified Capabilities

- `vod-recording`: the recording's session boundary and its start time are derived from the segment filenames, pre-live footage is excluded, and segments from an earlier broadcast are never included.

## Impact

- The finalize hook on the streaming VM.
- No app change: the bounds endpoint already returns `startedAt` alongside `liveAt`.
- Clears the stale 28-Jul-2026 segments that currently sit on the machine (AZ-214).
- Future VODs start at go-live, which is what chat replay, transcripts and timeline labels all already assume.
