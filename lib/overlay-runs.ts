import type { OverlayRun } from "@/lib/overlay-markup";

// Editing operations over styled runs, kept away from the DOM so the awkward
// part — splitting a run because a selection lands inside it — can be proven
// without a browser.

export type RunMark = "bold" | "italic" | "underline";

export function runsToPlainText(runs: OverlayRun[]): string {
  return runs.map((run) => run.text).join("");
}

function sameMarks(a: OverlayRun, b: OverlayRun): boolean {
  return (
    a.bold === b.bold &&
    a.italic === b.italic &&
    a.underline === b.underline &&
    a.color === b.color
  );
}

// Adjacent runs carrying the same marks become one, and empty runs disappear.
// Without this, styling and unstyling the same word leaves a trail of fragments
// that serialize to noisy markup.
export function mergeRuns(runs: OverlayRun[]): OverlayRun[] {
  const out: OverlayRun[] = [];
  for (const run of runs) {
    if (!run.text) continue;
    const last = out[out.length - 1];
    if (last && sameMarks(last, run)) last.text += run.text;
    else out.push({ ...run });
  }
  return out;
}

// Cuts the run list at a plain-text offset, so a selection boundary inside a run
// becomes a boundary between runs.
function splitAt(runs: OverlayRun[], offset: number): OverlayRun[] {
  const out: OverlayRun[] = [];
  let seen = 0;
  for (const run of runs) {
    const start = seen;
    const end = seen + run.text.length;
    if (offset > start && offset < end) {
      const cut = offset - start;
      out.push({ ...run, text: run.text.slice(0, cut) });
      out.push({ ...run, text: run.text.slice(cut) });
    } else {
      out.push({ ...run });
    }
    seen = end;
  }
  return out;
}

function withinSelection(
  runs: OverlayRun[],
  start: number,
  end: number
): boolean[] {
  const flags: boolean[] = [];
  let seen = 0;
  for (const run of runs) {
    const runStart = seen;
    const runEnd = seen + run.text.length;
    flags.push(runStart >= start && runEnd <= end && run.text.length > 0);
    seen = runEnd;
  }
  return flags;
}

// True when every character of the selection already carries the mark, which is
// what makes a control toggle rather than only ever apply.
export function markIsActive(
  runs: OverlayRun[],
  start: number,
  end: number,
  mark: RunMark
): boolean {
  if (start >= end) return false;
  const split = splitAt(splitAt(runs, start), end);
  const inside = withinSelection(split, start, end);
  const selected = split.filter((_, i) => inside[i]);
  return selected.length > 0 && selected.every((run) => run[mark]);
}

export function applyMark(
  runs: OverlayRun[],
  start: number,
  end: number,
  mark: RunMark,
  value: boolean
): OverlayRun[] {
  if (start >= end) return runs;
  const split = splitAt(splitAt(runs, start), end);
  const inside = withinSelection(split, start, end);
  return mergeRuns(
    split.map((run, i) => (inside[i] ? { ...run, [mark]: value } : run))
  );
}

export function applyColor(
  runs: OverlayRun[],
  start: number,
  end: number,
  color: string | null
): OverlayRun[] {
  if (start >= end) return runs;
  const split = splitAt(splitAt(runs, start), end);
  const inside = withinSelection(split, start, end);
  return mergeRuns(
    split.map((run, i) => (inside[i] ? { ...run, color } : run))
  );
}

// Replaces a range with typed text, which inherits the marks of the character
// before it — what every text editor does, and what stops typing inside a bold
// word from coming out unstyled.
export function replaceRange(
  runs: OverlayRun[],
  start: number,
  end: number,
  text: string
): OverlayRun[] {
  const split = splitAt(splitAt(runs, start), end);
  const inside = withinSelection(split, start, end);
  const kept: OverlayRun[] = [];
  let inserted = false;

  let seen = 0;
  for (let i = 0; i < split.length; i += 1) {
    const run = split[i];
    const runStart = seen;
    seen += run.text.length;
    if (inside[i]) {
      if (!inserted && text) {
        kept.push({ ...run, text });
        inserted = true;
      }
      continue;
    }
    kept.push({ ...run });
    if (!inserted && text && runStart + run.text.length === start) {
      kept.push({ ...run, text });
      inserted = true;
    }
  }

  if (!inserted && text) {
    const tail = kept[kept.length - 1];
    kept.push(
      tail
        ? { ...tail, text }
        : { text, bold: false, italic: false, underline: false, color: null }
    );
  }

  return mergeRuns(kept);
}
