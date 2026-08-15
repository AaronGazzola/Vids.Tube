## Context

`docs/overlay-platform.md` D5 settles the storage: *"Settings are an opaque blob owned by the overlay.
Per channel, per overlay. Vids.Tube stores and edits them and never interprets them."*

The sentence contains a tension worth naming rather than glossing: the host **edits** something it does
not **interpret**. An editor has to know that a field is a number between zero and one before it can draw
a slider, while never knowing that the number means how big a dragon is.

## Goals / Non-Goals

**Goals:**

- Settings are per channel per overlay, and the host stores values it does not understand.
- A streamer configures an overlay without writing JSON.
- A framed overlay reads its own settings and no one else's.
- A second overlay needs no migration and no host change.

**Non-Goals:**

- Pushing an edit to a running overlay. That is the message channel's job, and it is a separate change.
  Until then an overlay reads settings on load, which is when a streamer configuring before going live
  would expect them anyway.
- Any validation of a value's meaning. The host checks that a number is a number and stops.
- Settings for the dragon game. eco3d owns those and declares them from its own side.
- Per-viewer settings. Settings belong to a channel.

## Decisions

### The overlay declares its fields; the host renders them without understanding them

`overlays.settings_fields` holds an ordered list:

```
{ key, label, type, default, help?, min?, max?, step?, options? }
type: "number" | "toggle" | "text" | "choice" | "color"
```

The host draws a slider for a number with a min and a max, a switch for a toggle, a select for a choice.
It knows a field is a number in a range. It never knows what the number is for.

**Alternative rejected — a raw JSON textarea.** Host-agnostic and honest, and genuinely defensible with
one first-party overlay. Rejected because the first real setting is "how large is the creature", which is
a slider, and a streamer typing braces to answer that is a worse product than the schema is a cost.

**Alternative rejected — the overlay hosts its own settings page, framed inside the app.** This is
Twitch's model and it keeps the host perfectly ignorant. It costs a second framed surface, a second
handshake, and a second trust boundary inside the streamer's own dashboard, for a benefit that only
appears when a field type we do not have is needed. It stays possible: a `settings_url` on the registry
row would sit beside the declaration rather than replacing it.

**Alternative rejected — a general schema language such as JSON Schema.** Five field types cover
configuration; a schema language commits the host to a validator, a version and a specification it did
not write.

### Values are stored whole, and merged with declared defaults on read

`channel_overlays.settings` is a jsonb object, defaulting to `{}`. A value that is not declared is kept
rather than dropped, so an overlay that removes a field in one release and restores it in the next does
not lose a streamer's choice in between.

On read, declared defaults fill in anything the streamer has not set, so an overlay never receives a gap
for a field it declared.

### The host checks shape, never meaning

A number arrives as a number and inside its declared range; a choice is one of the declared options; text
has a length ceiling. That is the whole of the validation, and it exists to stop a broken editor writing
rubbish, not to police intent.

An undeclared key is rejected on write, so the editor cannot invent fields, while an already-stored
undeclared key survives as above. Written and stored are different questions.

### Reading uses a bearer token, unlike the exchange endpoint

`GET /api/overlay/settings` takes `Authorization: Bearer <token>`. The exchange endpoint takes its token
in a POST body, and the difference is deliberate: there the token is the **subject** of the request, the
thing being traded, while here it is the **credential** for reading something else.

The token names an installation, so it reads that installation's settings and no other. The same
cross-origin handling as the exchange, allowing exactly the origin the framing policy names.

### The dragon overlay declares nothing yet

Its editor is empty until eco3d names its fields. Inventing `creatureScale` here would put one game's
vocabulary in the host, which is the exact failure the opaque blob exists to prevent, and it would be
guessing at an interface eco3d has not designed.

## Risks / Trade-offs

- **A field declaration is host-shaped, so an overlay wanting a control we do not offer is stuck** →
  five types cover configuration, and the framed settings page above remains open as an addition rather
  than a replacement.
- **An overlay could declare a hundred fields and make the panel unusable** → not defended against.
  Registry rows are admitted, and the review flow that would catch this is already deferred.
- **Settings read on load only, so an edit during a stream does nothing until the source is refreshed** →
  stated in the editor rather than left to surprise the streamer, and removed by the message channel.
- **A stale token still reads settings until it expires** → it names the same installation it always did,
  and the settings it reads are the streamer's own. Revocation arrives with rotation, not here.

## Migration Plan

1. Push the migration adding both columns. Both default empty, so nothing changes behaviour.
2. Deploy. The editor appears, empty, because the dragon declares no fields yet.
3. eco3d declares its fields when it has them, by an update to its registry row.
