# Tasks — game window on the stream overlay

**Order rule.** The Eco3D change `add-dragon-overlay-embed` must be code-complete first, because section 4
needs a real address serving a real dragon. Until then the window has nothing to show and cannot be
judged.

**Evidence rule.** A box is checked only with a result that would have failed had the work not been done.
The overlay is verified by driving a browser with Playwright, which is already configured here. A frame
that is present in the DOM is not evidence: a blocked frame is also present in the DOM. Evidence is the
absence of a policy violation plus a screenshot showing the creature.

## 1. The new surface

- [x] 1.1 Done. The compiler named every site, including one that had to be reworked rather than extended:
      the goal-metric map was keyed by everything a surface is NOT, so each new surface broke it in an
      unrelated file. It is now keyed by the two goal surfaces themselves and will not need touching again.
- [x] 1.2 Done at 480 by 320. On the 1080-wide canvas that is a little under half the width, so the ghost
      is neither hairline nor edge-to-edge.
- [x] 1.3 Done — default scale 1, opacity 1, hidden, placed right of the ladder and below the viewers goal,
      the band no other surface claims by default.
- [x] 1.4 Confirmed against the owner's saved layout, which predates this change: every other surface kept
      its position, scale and opacity, and the new surface took its default. No version bump.

## 2. Rendering the window

- [x] 2.1 Done — logged and nothing rendered when the address is unset.
- [x] 2.2 Done, and the window was made a shared component rather than living in the overlay page: the
      layout editor's preview needs the same window, or the owner is dragging an empty rectangle.
- [x] 2.3 Confirmed by reading the render path: the address comes only from build-time configuration.
- [x] 2.4 Confirmed — the ghost and the rendered window take their size from the same one definition.

## 3. The security policy

- [x] 3.1 Done, via the existing origin helper, so only the origin enters the header and the rig and
      configuration in the rest of the value do not.
- [x] 3.2 Confirmed from the served headers: `frame-src http://localhost:3001` alongside an unchanged
      `frame-ancestors 'none'` and `X-Frame-Options: DENY`.
- [x] 3.3 Confirmed directive by directive: `frame-src` is the only addition.

## 4. Prove the window shows the dragon

- [x] 4.1 Done — the game served on port 3001, this app built with that address and served on port 3005.
- [x] 4.2 Done, as a spec that turns the surface on for the run and puts the owner's saved layout back
      afterwards, following the pattern the demo-interactivity spec already uses. No policy violation was
      reported.
- [x] 4.3 Confirmed by reaching a canvas INSIDE the frame, which a blocked frame cannot offer, and by a
      screenshot of the window showing the creature.
- [x] 4.4 Confirmed at 20 s apart: the two shots differ, so the window is live rather than a first frame.
      The check fails if they are byte-identical.
- [x] 4.5 Confirmed — the surrounding surfaces still render.

## 5. Land it

- [ ] 5.1 Raise the composite check over live video as a Linear issue: how the window reads over real video
      needs a running stream and the owner's eye.
- [ ] 5.2 Add `NEXT_PUBLIC_GAME_EMBED_URL` to Doppler so a normal build picks the address up. The
      verification runs passed the value in on the command line; nothing has been written to Doppler.
- [ ] 5.3 Run `openspec validate --strict` and archive.
