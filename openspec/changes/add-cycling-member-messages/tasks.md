# Tasks — cycling messages on the members strip

**Evidence rule.** A box is checked only with a result that would have failed had the work
not been done. A message present in the DOM is not evidence that the strip cycles, and a
transition that is described in CSS is not evidence that it runs: the strip is driven with
Playwright, which is already configured here, and judged from what it shows over time and
mid-transition.

## 1. The markup

- [ ] 1.1 Add `lib/overlay-markup.ts`, pure and testable, with no React and no database
      access, so the dialect can be proven without rendering an overlay.
- [ ] 1.2 In it, add `parseOverlayMessage(text)` returning an ordered list of runs, each
      carrying its text and its bold, italic, underline and colour state, for the dialect
      `**bold**`, `*italic*`, `__underline__` and `{#rrggbb|coloured text}`.
- [ ] 1.3 Have the parser combine marks, so a run nested inside another carries both.
- [ ] 1.4 Have the parser emit malformed markup as literal text rather than throwing or
      dropping it: an unclosed pair and a colour token that is not a six-digit hex are both
      returned as the characters that were typed.
- [ ] 1.5 Add `visibleLength(text)` returning the length with markup removed, so the cap
      counts what a viewer sees rather than what is stored.
- [ ] 1.6 Add `tests/unit/overlay-markup.test.ts` covering each mark alone, marks combined,
      the two malformed cases, text containing angle brackets returned as literal text, and
      visible length against a message whose markup is longer than its words.

## 2. Storing the messages

- [ ] 2.1 Add a message list to the overlay layout shape in `app/(app)/live/demo.types.ts`,
      stored as the text the streamer wrote.
- [ ] 2.2 In `mergeDemoLayout`, default an absent or unreadable message list to a single
      message holding today's sentence, so a layout saved before this change renders exactly
      as it does now and no version bump is needed.
- [ ] 2.3 Extend the existing merge tests to assert that adding messages to a saved layout
      leaves every box position, scale, toggle and opacity untouched, since positions are
      expensive to redo and share this value.

## 3. Rendering the strip

- [ ] 3.1 Add a component that draws a parsed message as elements, one per run, so no
      message is ever turned into markup by the browser and there is no sanitiser to get
      wrong.
- [ ] 3.2 In `components/overlay/member-count-strip.tsx`, take the message list and render
      the messages stacked inside a fixed-height window with overflow hidden.
- [ ] 3.3 Advance the stack downward by exactly one message height per step, so the message
      showing leaves at the bottom and the next arrives from above, transforming one element
      rather than animating layout.
- [ ] 3.4 Draw the member count beside the first message only, and give every later message
      the full width of the strip.
- [ ] 3.5 Render a single message, or an empty list, statically: no stack, no transition and
      no timer.
- [ ] 3.6 Define the dwell as one named constant in `lib/demo-overlay.ts` alongside the
      other overlay constants, so it can become a setting later without moving anything
      else.
- [ ] 3.7 Keep the strip's height fixed and its messages unwrapped across messages of
      different lengths.

## 4. Writing the messages

- [ ] 4.1 Add a Messages section to `app/(app)/live/settings-tab.tsx`, following the shape
      the Projects and Chat commands sections already use, listing the configured messages
      with add, remove and reorder.
- [ ] 4.2 Give each message a text field and controls for bold, italic, underline and
      colour, where activating a control wraps the current selection in the corresponding
      markup and inserts an empty pair when nothing is selected.
- [ ] 4.3 Make the colour control a colour input that writes the chosen colour into the
      token, so a colour is picked rather than typed.
- [ ] 4.4 Draw each message beneath its field exactly as the overlay draws it, on the
      overlay's own backing, so an unreadable colour is visible as unreadable before it goes
      on air.
- [ ] 4.5 Show the remaining visible length as a message is written, and refuse to save a
      message over the cap, naming the limit.
- [ ] 4.6 Save messages through the existing layout save, so an edit rides the push that
      already carries a layout change and no second subscription is added to the overlay.

## 5. Prove it on the overlay

- [ ] 5.1 Add `tests/unit/member-count-strip.test.tsx` asserting the count renders beside
      the first message and is absent from a later one, and that one message renders without
      a transition.
- [ ] 5.2 Add `tests/e2e/member-messages.spec.ts` configuring several messages, then
      asserting from the overlay that the message showing changes over time and that the
      order repeats. Reading the DOM once proves nothing here.
- [ ] 5.3 In that spec, capture the strip mid-transition and assert two messages are partly
      visible with the outgoing one lower, so the direction is proven rather than assumed
      from the stylesheet.
- [ ] 5.4 In that spec, assert the strip's height and its single-line rule hold across
      messages of very different lengths.
- [ ] 5.5 In that spec, assert a formatted message renders bold, italic, underlined and
      coloured runs on the overlay, and that a malformed message still shows its words.
- [ ] 5.6 Restore the owner's saved layout after the run, following the pattern the existing
      overlay specs use, so a test never costs the owner their positions.

## 6. Land it

- [ ] 6.1 Run `openspec validate --strict` and archive.
