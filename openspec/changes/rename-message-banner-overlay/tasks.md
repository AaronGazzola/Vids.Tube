## 1. The markup round trip

- [ ] 1.1 Add `serializeOverlayMessage(runs)` to `lib/overlay-markup.ts`, the inverse of
      `parseOverlayMessage`, emitting the same four forms the parser accepts.
- [ ] 1.2 Add `tests/unit/overlay-markup-roundtrip.test.ts` asserting that parsing then
      serializing reproduces the original string for every supported form, for nested styles,
      and for malformed input, which must survive as its own literal text.

## 2. Rename the stored key

- [ ] 2.1 Create a migration with `npx supabase migration new rename_members_box_to_message_banner`
      that rewrites `overlay_layouts.config`, moving the `members` entry in `boxes`, `visible`
      and `boxOpacity` to `messageBanner`, leaving a config that already carries the new key
      untouched and every other overlay's entries unmoved.
- [ ] 2.2 Push the migration with `npx supabase db push` and regenerate `supabase/types.ts`.
- [ ] 2.3 Add `scripts/verify-message-banner-migration.ts` that reports, per saved layout,
      whether the overlay's position, scale, visibility and opacity are identical before and
      after, so the migration is proven against real rows rather than assumed.

## 3. Rename in code

- [ ] 3.1 Rename the box key from `members` to `messageBanner` in `app/(app)/live/demo.types.ts`,
      including `DEMO_BOX_KEYS`, `DEMO_OVERLAY_KEYS`, `DEMO_OVERLAY_LABELS` and the default
      layout, with the label reading "Message banner".
- [ ] 3.2 Add no entry for the new version to `RESET_AT_VERSION`, so the rename never resets a
      position, and bump `DEMO_LAYOUT_VERSION` since the stored shape does change here.
- [ ] 3.3 Rename `components/overlay/member-count-strip.tsx` to `message-banner.tsx` and its
      exported component, updating every import.
- [ ] 3.4 Rename its test ids from `member-strip-*` to `message-banner-*`, and update
      `tests/unit/member-count-strip.test.tsx` and `tests/e2e/member-messages.spec.ts` to match.
- [ ] 3.5 Update the remaining references in `components/overlay/overlay-stage.tsx`,
      `app/(app)/live/overlays-tab.tsx`, `app/(app)/live/overlays-demo.tsx` and
      `app/(overlay)/overlay/[channelSlug]/page.tsx`.

## 4. The rich text editor

- [ ] 4.1 Build the editable field in `app/(app)/live/settings-tab.tsx` as a contenteditable
      rendering styled runs, using the banner's own typography and backing, with the member
      count shown beside the first message and not editable.
- [ ] 4.2 Apply bold, italic and underline to the current selection, and colour from a fixed
      palette, updating the styled runs rather than inserting markup characters.
- [ ] 4.3 Convert to markup on change through `serializeOverlayMessage`, so the draft the store
      holds stays in the stored format and the existing save path is unchanged.
- [ ] 4.4 Parse an existing message into styled runs when it is loaded for editing.
- [ ] 4.5 Reduce pasted content to the supported styles, taking anything unsupported as plain
      text.
- [ ] 4.6 Keep the existing visible-length cap enforced against the message's visible text
      rather than its markup.

## 5. Prove it

- [ ] 5.1 Update `tests/unit/overlay-messages-editor.test.tsx` for the new field: applying a
      style to a selection changes the styled runs, the generated markup matches, and the cap is
      enforced on visible length.
- [ ] 5.2 Add a test asserting the default layout carries exactly one message, so a future edit
      cannot reintroduce a list.
- [ ] 5.3 Run the migration verification script against the real project and confirm every saved
      layout reports identical geometry before and after.
- [ ] 5.4 Run `tests/e2e/member-messages.spec.ts` against the renamed test ids and confirm the
      banner still cycles, transitions and renders formatting on the overlay.

## 6. Land it

- [ ] 6.1 Run `openspec validate --strict` and archive.
