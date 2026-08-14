import { parseOverlayMessage } from "@/lib/overlay-markup";
import { serializeOverlayMessage } from "@/lib/overlay-markup-serialize";
import { describe, expect, it } from "vitest";

// Opening a message for editing parses it; saving serializes it. The property
// that protects the streamer is that doing both without editing anything cannot
// change how the message renders.
const roundTrip = (markup: string) =>
  serializeOverlayMessage(parseOverlayMessage(markup));

const CASES = [
  "plain words",
  "say **bold** here",
  "say *lean* here",
  "say __under__ here",
  "say {#ff0055|hot} here",
  "**bold** and *italic* and __under__",
  "{#00ccb3|a colour with **bold** inside}",
  "**bold with {#ff0055|colour} inside**",
  "",
  "trailing **",
  "join **us today",
  "unclosed {#ff0055|colour",
  "}stray brace{",
  "*",
  "****",
];

describe("markup round trip", () => {
  it("renders identically after a parse and serialize, for every form", () => {
    for (const markup of CASES) {
      expect(
        parseOverlayMessage(roundTrip(markup)),
        `"${markup}" changed meaning`
      ).toEqual(parseOverlayMessage(markup));
    }
  });

  it("is stable, so saving repeatedly never drifts", () => {
    for (const markup of CASES) {
      const once = roundTrip(markup);
      expect(roundTrip(once), `"${markup}" drifted on a second pass`).toBe(once);
    }
  });

  it("reproduces canonically written markup exactly", () => {
    const canonical = [
      "plain words",
      "say **bold** here",
      "say *lean* here",
      "say __under__ here",
      "say {#ff0055|hot} here",
      "**bold** and *italic* and __under__",
    ];
    for (const markup of canonical) {
      expect(roundTrip(markup)).toBe(markup);
    }
  });

  it("keeps every visible word, including in a malformed message", () => {
    const visible = (markup: string) =>
      parseOverlayMessage(markup)
        .map((run) => run.text)
        .join("");

    for (const markup of CASES) {
      expect(visible(roundTrip(markup)), `"${markup}" lost words`).toBe(
        visible(markup)
      );
    }
  });

  it("nests colour outside the other marks, so the order is deterministic", () => {
    expect(roundTrip("**{#ff0055|a}**")).toBe("{#ff0055|**a**}");
    expect(roundTrip("{#ff0055|**a**}")).toBe("{#ff0055|**a**}");
  });
});
