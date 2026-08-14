## Context

The layout config stores per-overlay entries under a box key, and `members` is one of them. The
key appears in `boxes`, `visible` and `boxOpacity`, in the default layout, in the reset-version
machinery, and in the test ids the browser specs read. It is also the name shown to the owner.

Messages are stored as markup strings and parsed for display by `parseOverlayMessage`, which
returns styled runs. There is no inverse: nothing turns styled runs back into markup, which is
why the editor is a raw text box.

## Goals / Non-Goals

**Goals:**

- One name for the overlay, everywhere, including in the database.
- Writing a message looks like the message.
- Existing saved layouts keep their positions, sizes, opacity and messages.

**Non-Goals:**

- Changing the markup format. It stays the stored representation.
- Adding styles the overlay cannot render.
- Changing the member count itself, which the banner still shows.

## Decisions

### The stored key is renamed by migration, not by a compatibility shim

The config is JSON in one column, so the rename is a single update rewriting the three places
the key appears, guarded so a config already carrying `messageBanner` is left alone.

*Alternative considered:* read both keys forever and write the new one. Rejected: it leaves two
names in the code permanently, which is the thing being fixed, and the shim would outlive
everyone's memory of why it exists.

*Consequence:* the migration must be idempotent and must not disturb any other key, because the
same column carries every other overlay's position.

### The markup stays the stored format, and gains a serializer

The editor works on styled runs, and converts to markup on the way out and from markup on the
way in. `parseOverlayMessage` already provides one direction; this adds the other.

The pair must round-trip: parsing a message and re-serializing it must produce the same string,
or editing a message would silently rewrite it. That property is the main thing worth testing,
and it is testable without a browser.

*Alternative considered:* store the styled runs directly and drop the markup. Rejected: the
markup is what the overlay renders from today, it is human-writable, and changing the stored
format would need its own migration for no gain.

### The editor is a contenteditable over the same components the overlay uses

Styling is applied to a selection, exactly as a text editor does, and the field renders with the
overlay's own typography so what is typed is what appears. The count sits beside it as it does
on the overlay, unstyled and not editable, so the line's real width is visible while writing.

Colour is a discrete choice from a small palette rather than a free picker, because the markup
carries a hex value and an arbitrary one can render illegibly over a stream.

*Risk accepted:* a contenteditable that round-trips to markup is the most delicate part of this
change. Pasting styled content from elsewhere is normalised to the supported styles, and
anything unsupported is taken as plain text.

### One default message, asserted rather than assumed

The default is already a single message. A test pins it, so a future edit to the default layout
cannot quietly reintroduce a list.

## Risks / Trade-offs

- [The migration runs against every saved layout and could lose a position] → It moves keys
  within the same object rather than rebuilding it, is idempotent, and is verified by
  round-tripping a real saved layout before and after.
- [Round-tripping loses formatting on an existing message] → The parse-and-serialize property is
  tested against every markup form the parser supports, including malformed input, which must
  survive as its own literal text.
- [Renaming test ids breaks the browser specs that read them] → Those specs are updated in the
  same change and run, rather than left to fail later.
- [A contenteditable behaves differently across browsers] → The editor is covered by unit tests
  at the conversion layer, where the logic lives, and by one browser assertion that typed text
  reaches the overlay.
