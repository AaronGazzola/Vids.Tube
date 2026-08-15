import { describe, expect, it } from "vitest";
import { parseOverlayCommands } from "@/lib/overlay-commands";

const FEED = { keyword: "feed", description: "Feed the creature" };

describe("parsing the commands an overlay declares", () => {
  it("keeps a good declaration, with its optional limits", () => {
    expect(
      parseOverlayCommands([
        { ...FEED, cooldown_s: 30, max_per_stream: 5 },
      ])
    ).toEqual([{ ...FEED, cooldown_s: 30, max_per_stream: 5 }]);
  });

  it("keeps a declaration with no limits at all", () => {
    expect(parseOverlayCommands([FEED])).toEqual([FEED]);
  });

  // The registry's own keyword rule. An overlay must not be able to declare
  // something the parser could never match.
  it("drops a keyword the command parser could never match", () => {
    expect(parseOverlayCommands([{ ...FEED, keyword: "Feed" }])).toEqual([]);
    expect(parseOverlayCommands([{ ...FEED, keyword: "feed!" }])).toEqual([]);
    expect(parseOverlayCommands([{ ...FEED, keyword: "" }])).toEqual([]);
    expect(parseOverlayCommands([{ ...FEED, keyword: "!feed" }])).toEqual([]);
  });

  it("drops an entry with no description", () => {
    expect(parseOverlayCommands([{ keyword: "feed" }])).toEqual([]);
    expect(parseOverlayCommands([{ ...FEED, description: "" }])).toEqual([]);
  });

  it("drops a duplicate rather than letting the second win", () => {
    const parsed = parseOverlayCommands([
      FEED,
      { ...FEED, description: "Something else" },
    ]);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].description).toBe("Feed the creature");
  });

  it("drops a limit that makes no sense, keeping the command", () => {
    expect(
      parseOverlayCommands([
        { ...FEED, cooldown_s: -5, max_per_stream: 0 },
      ])
    ).toEqual([FEED]);
  });

  it("keeps the good entries when one is bad", () => {
    const parsed = parseOverlayCommands([
      "not an object",
      { ...FEED, keyword: "BAD" },
      FEED,
    ]);
    expect(parsed).toEqual([FEED]);
  });

  it("treats a declaration that is not a list as none", () => {
    expect(parseOverlayCommands(null)).toEqual([]);
    expect(parseOverlayCommands({ keyword: "feed" })).toEqual([]);
  });
});
