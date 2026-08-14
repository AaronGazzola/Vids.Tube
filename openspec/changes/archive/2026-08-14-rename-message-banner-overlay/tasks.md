## 1. The markup round trip

- [x] 1.1 Added `serializeOverlayMessage(runs)` in `lib/overlay-markup-serialize.ts` rather than
      beside the parser, so the parser stays a pure reader with no writer bolted onto it.
- [x] 1.2 `tests/unit/overlay-markup-roundtrip.test.ts` proves the round trip preserves meaning
      and every visible character, is stable across repeated saves, and reproduces canonically
      written markup exactly. Byte-identical output for every form turned out to be impossible:
      the dialect does not record the order nested marks were written in, so a colour wrapping
      bold and bold wrapping a colour parse to the same thing. Serializing picks one canonical
      nesting instead, and the spec was corrected to match.

## 2. Rename the stored key

- [x] 2.1 Create a migration with `npx supabase migration new rename_members_box_to_message_banner`
      that rewrites `overlay_layouts.config`, moving the `members` entry in `boxes`, `visible`
      and `boxOpacity` to `messageBanner`, leaving a config that already carries the new key
      untouched and every other overlay's entries unmoved.
- [x] 2.2 Push the migration with `npx supabase db push` and regenerate `supabase/types.ts`.
- [x] 2.3 Add `scripts/verify-message-banner-migration.ts` that reports, per saved layout,
      whether the overlay's position, scale, visibility and opacity are identical before and
      after, so the migration is proven against real rows rather than assumed.

## 3. Rename in code

- [x] 3.1 Rename the box key from `members` to `messageBanner` in `app/(app)/live/demo.types.ts`,
      including `DEMO_BOX_KEYS`, `DEMO_OVERLAY_KEYS`, `DEMO_OVERLAY_LABELS` and the default
      layout, with the label reading "Message banner".
- [x] 3.2 No entry added to `RESET_AT_VERSION`, and `DEMO_LAYOUT_VERSION` deliberately left at 3.
      The migration moves every saved config, so no client ever meets the old key, and a bump
      with no reset keys would run the reset machinery over an already-correct shape for no
      gain — the exact risk the task existed to avoid.
- [x] 3.3 Rename `components/overlay/member-count-strip.tsx` to `message-banner.tsx` and its
      exported component, updating every import.
- [x] 3.4 Rename its test ids from `member-strip-*` to `message-banner-*`, and update
      `tests/unit/member-count-strip.test.tsx` and `tests/e2e/member-messages.spec.ts` to match.
- [x] 3.5 Update the remaining references in `components/overlay/overlay-stage.tsx`,
      `app/(app)/live/overlays-tab.tsx`, `app/(app)/live/overlays-demo.tsx` and
      `app/(overlay)/overlay/[channelSlug]/page.tsx`.

## 4. The rich text editor

- [x] 4.1 Built as `app/(app)/live/message-banner-field.tsx`, a contenteditable rendering styled
      runs. Its spans are written imperatively rather than by React: a contenteditable is edited
      by the browser too, and letting both write the same nodes made React try to remove
      children the browser had already replaced. The banner's own backing and the member count
      stay in the rendering beside the field rather than becoming the field, because the banner
      is 810 wide and the settings column is not. The spec was corrected to match.
- [x] 4.2 Apply bold, italic and underline to the current selection, and colour from a fixed
      palette, updating the styled runs rather than inserting markup characters.
- [x] 4.3 Convert to markup on change through `serializeOverlayMessage`, so the draft the store
      holds stays in the stored format and the existing save path is unchanged.
- [x] 4.4 Parse an existing message into styled runs when it is loaded for editing.
- [x] 4.5 Reduce pasted content to the supported styles, taking anything unsupported as plain
      text.
- [x] 4.6 Keep the existing visible-length cap enforced against the message's visible text
      rather than its markup.

## 5. Prove it

- [x] 5.1 Update `tests/unit/overlay-messages-editor.test.tsx` for the new field: applying a
      style to a selection changes the styled runs, the generated markup matches, and the cap is
      enforced on visible length.
- [x] 5.2 Add a test asserting the default layout carries exactly one message, so a future edit
      cannot reintroduce a list.
- [x] 5.3 Run the migration verification script against the real project and confirm every saved
      layout reports identical geometry before and after.
- [x] 5.4 Run `tests/e2e/member-messages.spec.ts` against the renamed test ids and confirm the
      banner still cycles, transitions and renders formatting on the overlay.

## 6. Land it

- [x] 6.1 Run `openspec validate --strict` and archive.
