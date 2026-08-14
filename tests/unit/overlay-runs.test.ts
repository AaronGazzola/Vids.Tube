import { parseOverlayMessage } from "@/lib/overlay-markup";
import { serializeOverlayMessage } from "@/lib/overlay-markup-serialize";
import {
  applyColor,
  applyMark,
  markIsActive,
  mergeRuns,
  replaceRange,
  runsToPlainText,
} from "@/lib/overlay-runs";
import { describe, expect, it } from "vitest";

const runs = (markup: string) => parseOverlayMessage(markup);
const markup = (r: ReturnType<typeof runs>) => serializeOverlayMessage(r);

describe("applyMark", () => {
  it("styles a whole word", () => {
    const next = applyMark(runs("say hello there"), 4, 9, "bold", true);
    expect(markup(next)).toBe("say **hello** there");
  });

  it("splits a run when the selection lands inside it", () => {
    const next = applyMark(runs("hello"), 1, 3, "italic", true);
    expect(markup(next)).toBe("h*el*lo");
    expect(runsToPlainText(next)).toBe("hello");
  });

  it("removes a mark from part of a styled run", () => {
    const next = applyMark(runs("**hello**"), 0, 2, "bold", false);
    expect(markup(next)).toBe("he**llo**");
  });

  it("leaves the text alone whatever the styling", () => {
    const text = "say hello there";
    for (const [from, to] of [
      [0, 3],
      [4, 9],
      [2, 12],
      [0, text.length],
    ]) {
      expect(runsToPlainText(applyMark(runs(text), from, to, "bold", true))).toBe(
        text
      );
    }
  });

  it("does nothing without a selection", () => {
    const before = runs("hello");
    expect(applyMark(before, 3, 3, "bold", true)).toBe(before);
  });
});

describe("markIsActive", () => {
  it("is true only when every selected character carries the mark", () => {
    expect(markIsActive(runs("**hello**"), 0, 5, "bold")).toBe(true);
    expect(markIsActive(runs("**he**llo"), 0, 5, "bold")).toBe(false);
    expect(markIsActive(runs("**hello**"), 1, 4, "bold")).toBe(true);
  });

  it("is false with nothing selected, so a control never reads as on", () => {
    expect(markIsActive(runs("**hello**"), 2, 2, "bold")).toBe(false);
  });
});

describe("applyColor", () => {
  it("colours a selection and can clear it again", () => {
    const coloured = applyColor(runs("hot stuff"), 0, 3, "#ff0055");
    expect(markup(coloured)).toBe("{#ff0055|hot} stuff");
    expect(markup(applyColor(coloured, 0, 3, null))).toBe("hot stuff");
  });
});

describe("replaceRange", () => {
  it("inserts typed text carrying the marks around it", () => {
    const next = replaceRange(runs("**hello**"), 5, 5, "!");
    expect(markup(next)).toBe("**hello!**");
  });

  it("replaces a selection", () => {
    expect(markup(replaceRange(runs("say hello"), 4, 9, "bye"))).toBe("say bye");
  });

  it("deletes when the replacement is empty", () => {
    expect(markup(replaceRange(runs("say hello"), 3, 9, ""))).toBe("say");
  });
});

describe("mergeRuns", () => {
  it("joins neighbours that match and drops empties", () => {
    const merged = mergeRuns([
      { text: "a", bold: true, italic: false, underline: false, color: null },
      { text: "", bold: true, italic: false, underline: false, color: null },
      { text: "b", bold: true, italic: false, underline: false, color: null },
      { text: "c", bold: false, italic: false, underline: false, color: null },
    ]);
    expect(merged).toHaveLength(2);
    expect(markup(merged)).toBe("**ab**c");
  });
});
