import { parseOverlayMessage, visibleLength } from "@/lib/overlay-markup";
import { describe, expect, it } from "vitest";

const textOf = (input: string) =>
  parseOverlayMessage(input)
    .map((r) => r.text)
    .join("");

describe("each mark on its own", () => {
  it("draws a bold run bold and nothing else", () => {
    expect(parseOverlayMessage("**loud**")).toEqual([
      { text: "loud", bold: true, italic: false, underline: false, color: null },
    ]);
  });

  it("draws an italic run italic", () => {
    expect(parseOverlayMessage("*lean*")).toEqual([
      { text: "lean", bold: false, italic: true, underline: false, color: null },
    ]);
  });

  it("draws an underlined run underlined", () => {
    expect(parseOverlayMessage("__under__")).toEqual([
      {
        text: "under",
        bold: false,
        italic: false,
        underline: true,
        color: null,
      },
    ]);
  });

  it("draws a coloured run in the colour that was chosen", () => {
    expect(parseOverlayMessage("{#ff0055|hot}")).toEqual([
      {
        text: "hot",
        bold: false,
        italic: false,
        underline: false,
        color: "#ff0055",
      },
    ]);
  });

  it("reads a colour written in capitals as the same colour", () => {
    expect(parseOverlayMessage("{#FF0055|hot}")[0].color).toBe("#ff0055");
  });

  it("leaves a message with no markup as one plain run", () => {
    expect(parseOverlayMessage("Chat to become a member!")).toEqual([
      {
        text: "Chat to become a member!",
        bold: false,
        italic: false,
        underline: false,
        color: null,
      },
    ]);
  });
});

describe("marks combined on one run", () => {
  it("carries both kinds when one mark is nested inside another", () => {
    expect(parseOverlayMessage("**__both__**")).toEqual([
      { text: "both", bold: true, italic: false, underline: true, color: null },
    ]);
  });

  it("carries a colour and a weight together", () => {
    expect(parseOverlayMessage("{#00ff88|**go**}")).toEqual([
      {
        text: "go",
        bold: true,
        italic: false,
        underline: false,
        color: "#00ff88",
      },
    ]);
  });

  it("marks only the nested part, leaving its neighbours alone", () => {
    const runs = parseOverlayMessage("say **it** now");
    expect(runs.map((r) => [r.text, r.bold])).toEqual([
      ["say ", false],
      ["it", true],
      [" now", false],
    ]);
  });
});

describe("malformed markup renders literally", () => {
  it("shows an unclosed bold marker as typed and still renders the rest", () => {
    expect(parseOverlayMessage("**never closed")).toEqual([
      {
        text: "**never closed",
        bold: false,
        italic: false,
        underline: false,
        color: null,
      },
    ]);
  });

  it("keeps the words around an unclosed marker", () => {
    expect(textOf("join **us today")).toBe("join **us today");
  });

  it("shows a colour that is not six hex digits as typed, uncoloured", () => {
    const runs = parseOverlayMessage("{#ff|nope}");
    expect(textOf("{#ff|nope}")).toBe("{#ff|nope}");
    expect(runs.every((r) => r.color === null)).toBe(true);
  });

  it("shows an unclosed colour token as typed", () => {
    expect(textOf("{#ff0055|forever")).toBe("{#ff0055|forever");
  });

  it("never throws, whatever punctuation is thrown at it", () => {
    for (const input of ["***", "__*_", "{#|}", "}{", "*", "{#ff0055|"]) {
      expect(() => parseOverlayMessage(input)).not.toThrow();
    }
  });
});

describe("text the browser must never read as markup", () => {
  it("returns angle brackets as ordinary characters in a run", () => {
    const runs = parseOverlayMessage("<script>alert(1)</script>");
    expect(runs).toHaveLength(1);
    expect(runs[0].text).toBe("<script>alert(1)</script>");
  });

  it("returns angle brackets sitting inside a mark as ordinary characters", () => {
    expect(parseOverlayMessage("**<b>**")).toEqual([
      { text: "<b>", bold: true, italic: false, underline: false, color: null },
    ]);
  });
});

describe("the length a viewer actually sees", () => {
  it("ignores markup, so formatting does not eat the budget", () => {
    expect(visibleLength("{#ff0055|**hi**}")).toBe(2);
  });

  it("counts a plain message as its own length", () => {
    expect(visibleLength("Chat to become a member at Vids.Tube!")).toBe(37);
  });

  it("counts an empty message as nothing", () => {
    expect(visibleLength("")).toBe(0);
  });

  it("counts an empty pair as nothing, which is what the editor inserts", () => {
    expect(visibleLength("****")).toBe(0);
  });

  it("counts the characters of markup that was typed wrong", () => {
    expect(visibleLength("**oops")).toBe(6);
  });
});
