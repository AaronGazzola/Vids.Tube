import type { OverlayRun } from "@/lib/overlay-markup";

// The inverse of parseOverlayMessage, for an editor that works on styled runs
// and stores markup.
//
// Marks nest, and the dialect does not record which order they were written in:
// `{#ff0055|**a**}` and `**{#ff0055|a}**` parse to the same run. Serializing
// therefore picks one canonical order — colour outermost, then bold, underline,
// italic — so the output is deterministic. What is guaranteed is that the result
// parses back to the runs it came from, which is what stops opening a message
// and saving it from changing how it renders.
//
// The dialect has no escape sequence, so a run whose text literally contains
// `**` cannot be distinguished from markup once written. That only arises for
// characters typed by hand in the editor, never for a message that came from
// parsing, and it is left as a known limit of the dialect rather than patched
// over with an escape nobody can type.
export function serializeOverlayRun(run: OverlayRun): string {
  let out = run.text;
  if (run.italic) out = `*${out}*`;
  if (run.underline) out = `__${out}__`;
  if (run.bold) out = `**${out}**`;
  if (run.color) out = `{${run.color}|${out}}`;
  return out;
}

export function serializeOverlayMessage(runs: OverlayRun[]): string {
  return runs.map(serializeOverlayRun).join("");
}
