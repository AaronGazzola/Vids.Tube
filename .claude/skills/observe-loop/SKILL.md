---
name: observe-loop
description: Establish and iterate an observation harness so an AI can SEE a system's behaviour (not infer it from numbers), change one lever at a time, and report each step to a human with a one-click demo and a visual aid. Use for any project where success is visual/behavioural and tuning is iterative (animation, simulation, layout, rendering, robotics, data viz). Invoke with /observe-loop.
---

# /observe-loop — observation harness + iteration protocol

Generic protocol for building eyes onto a running system and improving it one small,
verified step at a time. Project-agnostic: the examples use a character walk cycle, but the
shape applies to any system whose correctness is judged by watching it.

## The core idea

You cannot tune what you cannot see. Numbers lie (a render bug can draw the wrong thing
while the metrics look fine). So before tuning anything, build a harness that lets you
**observe the real running system**, then iterate: change ONE lever, observe the isolated
effect, report it with a demo + a visual aid, get a human's approval, continue.

Two readers consume your output: the **AI** (you, next turn) and the **human**. Both need
the same thing — clear observations, clear expectations, clear instructions. Write for
clarity, not for volume.

## Part 1 — Establish the harness

Build these capabilities once; reuse them every iteration.

1. **A control + read hook on the running system.** Expose a small programmatic surface on
   the live app (e.g. a `window.__debug` object, a CLI flag, a test endpoint) that can: set
   the full configuration, start/stop, read current state, and capture signals. Drive the
   real system through this — never scrape the UI, never reconstruct a parallel "puppet"
   that can drift from reality.
2. **Determinism.** Make a given input reproduce the same state: fixed time-step, seeded
   randomness, an explicit "advance N steps" primitive. Without this, a frozen frame is not
   reproducible and shared links/comparisons are meaningless.
3. **Freeze + step + slow-motion.** The single most useful observation tool is the ability
   to stop on a chosen frame, step one unit at a time, and play slowly. Most "everything
   moves at once, I can't tell what's wrong" pain dissolves once you can freeze and step.
4. **Focused signals, not raw dumps.** Capture the *minimum* that reveals the behaviour:
   - a **simplified skeleton/wireframe screenshot** (joints, key points, contact markers)
     beats a full-fidelity render for seeing structure;
   - when the real render is too **visually dense** to read (a detailed model, an overlapping
     scene), ghost it down to low opacity and show only key-point markers, or render a bare
     skeleton — fidelity hides structure, structure is what you are judging;
   - a few **overlays** that isolate one concern (phase markers, state coloring, force
     arrows, a single highlighted part with everything else dimmed);
   - a couple of scalar **gates** (drift, tilt, timing error) — as a cross-check, not the
     verdict.
5. **A headless capture path.** A headless browser/driver (e.g. Playwright + bundled
   Chromium) that loads the app via the control hook, runs to a state, toggles overlays, and
   screenshots from fixed camera angles. This is how you get eyes without a human in the
   loop.

6. **Isolate the period of interest, then sample it densely and repeatedly.** Do not sample
   on a coarse fixed clock (e.g. one frame per second) across the whole run. Detect the exact
   sub-interval that matters (one cycle, one grip window, one transition), take **N evenly
   spaced snapshots across just that interval** (about 10), and **capture the interval many
   times** (many cycles). Then **compare the instances**, state a **conclusion** from the
   spread (mean/range/consistency), **pick the single instance closest to the median** as the
   representative to show, and mark the snapshots that carry the conclusion. Present that one
   instance as the sequence — comparison gives confidence, the representative gives clarity.

Expand the harness whenever an iteration reveals something you could not isolate. A new
question → a new overlay or signal. The harness grows toward exactly what the work needs.

## Part 2 — Output format (for AI comprehension AND the human)

Optimise every artifact for **signal density that stays human-readable**:

- **Minimise character count / output density.** Short labels, small tables, no walls of
  text. A skeleton screenshot or a 4-frame strip carries more than paragraphs of prose.
- **Keep concepts clear and plainly named.** Even though the primary reader is an AI, it
  still needs unambiguous observations, expectations, and instructions. Name what each
  signal means in one line.
- **Prefer the right visual aid for the idea:**
  - a **left-to-right image sequence** for a cycle or motion (e.g. a walk cycle: 4–6
    freeze-frames at key phases), each frame **highlighting the relevant location** and a
    one-line caption below saying *what to look at and why it matters*;
  - a **chart** when comparing a scalar across configs;
  - a **flow chart** for a branching decision or pathway;
  - a plain **table** for several items across the same dimensions.
  Do not add a visual that merely restates a list.
- **Package decisions, not just pixels.** The artifact should record: the observation, why
  it is relevant, the change made, and the resulting effect.
- **Lay the artifact out for the screen it will be read on.** Find out the target display
  width and scale to it; do not assume a wide landscape page.
  - For a narrow screen (e.g. about 400px), use a **vertical (portrait) layout**: large-font
    `/plain` notes (bold one-line title, then short bullets), and the **sequence images
    cascading/staggered down one side** rather than a wide row that shrinks illegibly.
  - For a wide screen, a landscape row of frames is fine.
  - Either way: large enough fonts to read at the target width, one verdict line per step
    (colour-code good / none / bad), and a short caption under each frame.
  - Default the artifacts to a **dark theme** (black background, light text, dark frame
    panels) unless the human prefers otherwise.

## Part 3 — Share the live resource with the human

Numbers and PDFs are one-way. Always also give the human a way to **see exactly what you
see, instantly**:

- Encode the current configuration into a **shareable link** (e.g. `?config=<encoded>` plus
  view flags like the tab, a freeze time, and which overlays are on). One click reopens the
  exact state you observed.
- Prefer **full-config-in-link** over named-preset-in-link, so any one-off tuned state is
  shareable without first saving it.
- The link is the demo. Hand it over alongside the visual aid every iteration.
- **Make every artifact link click-to-open in the human's surface.** Link generated files
  (PDFs, images) in whatever form *their* tool resolves on click — there is no universal one,
  so match the surface:
  - in an **IDE chat** (e.g. VS Code), use a **workspace-relative path** (`docs/aid.pdf`),
    which the IDE turns into a clickable link that opens the file;
  - in a **browser** surface, use a **served `http(s)` URL** or an absolute `file://` URL.
  Avoid the mismatch cases (a bare relative path in a browser, or a `file://` URL in some IDE
  chats) — both render as dead links. The point is one click opens the PDF/image next to the
  demo link; verify the form works in the human's environment.

## Part 4 — The iteration loop

Run this loop per step. Keep each step tiny so cause and effect stay isolated.

1. **State the micro-goal** in one line, the **single lever** you will move, and the **one
   gate** that decides pass/fail. One lever at a time — if you move three knobs you learn
   nothing about any of them.
2. **Make the minimal change.** Prefer configuration. When the behaviour genuinely *needs*
   something configuration cannot express (a new mechanism, a phase-dependent term), add it
   as a new, off-by-default lever and flag it as a deviation.
3. **Observe in isolation.** Freeze at the key moments, enable only the overlays relevant to
   this lever, capture the focused signals (skeleton frames + the gate numbers).
4. **Report to the human**, concisely:
   - the **demo link** (one click to the exact state),
   - the **visual aid** (the annotated sequence / chart),
   - the **expectation** (what they should see),
   - the **quality gate** (what must be true for them to approve this step and continue),
   - the **next step** (one line).
5. **Get approval, then continue.** On approval, lock the result (save it as a named
   state/preset) and start the next micro-goal. If a code mechanism was added, fold it into
   the change/PR record.

## Part 5 — When to stop

- Stop and **report a verified step** when the current micro-goal's gate passes and you have
  a clean next direction.
- Keep iterating autonomously while you have a clear short-term direction and the gates keep
  passing.
- Stop and **ask for direction** (a short sit-rep + specific question) when you are blocked,
  the gate is ambiguous, two reasonable paths diverge, or repeated attempts fail. Do not
  thrash — a focused question beats five blind tries.

## Technical specifics (generic, adapt per project)

- **Driver:** a headless browser via Playwright (bundled Chromium) for web apps; the
  equivalent automation harness otherwise. Cache auth/session so runs are non-interactive.
- **Control hook:** an in-app object (e.g. `window.__debug`) exposing `applyConfig`,
  `getConfig`, `start/stop`, `pause/play/step(n)/seek(t)/speed(x)`, `setOverlays`, and a
  state read (`diag`). Capture buffers (positions/state over time) live here too.
- **Determinism:** fixed time-step accumulator; `step(n)` runs exactly n ticks; `seek(t)`
  rebuilds from t=0 and runs `round(t/dt)` ticks. Avoid wall-clock-coupled stepping for
  anything you want to reproduce.
- **Capture:** screenshot fixed camera angles (front/top/side); render a simplified skeleton
  from captured key-point positions rather than the full model when structure is what
  matters; write raw samples as compact JSON for re-analysis.
- **Visual aid generation:** assemble captured frames into an HTML page (images left→right,
  highlight boxes, captions) and print to a **landscape PDF** via the headless browser's
  print-to-PDF. Charts/flowcharts the same way.
- **Run environment notes:** run the driver and the app server from a shell that preserves
  the app's auth/network (some sandboxes reset it); use a loopback IP the server actually
  binds; rebuild before observing if the app is served from a production build; launch the
  server detached so it survives across separate command invocations.

## Anti-patterns

- Trusting metrics without looking at the frames.
- Moving multiple levers in one step.
- Dumping raw, dense output instead of a focused signal.
- Reporting without a one-click demo the human can open.
- Reconstructing a separate visualisation that can disagree with the real system.
