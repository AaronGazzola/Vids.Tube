import { describe, expect, it } from "vitest";
import { parseChatCommand } from "@/lib/chat-commands";

describe("parseChatCommand", () => {
  it("parses a bare command", () => {
    expect(parseChatCommand("!help")).toEqual({ keyword: "help", args: "" });
  });

  it("lowercases the keyword and trims args", () => {
    expect(parseChatCommand("!TTS hello there")).toEqual({
      keyword: "tts",
      args: "hello there",
    });
  });

  it("keeps multiline args", () => {
    expect(parseChatCommand("!ask line one\nline two")).toEqual({
      keyword: "ask",
      args: "line one\nline two",
    });
  });

  it("tolerates surrounding whitespace", () => {
    expect(parseChatCommand("  !me  ")).toEqual({ keyword: "me", args: "" });
  });

  it("rejects non-commands", () => {
    expect(parseChatCommand("hello!")).toBeNull();
    expect(parseChatCommand("!")).toBeNull();
    expect(parseChatCommand("!!fun")).toBeNull();
    expect(parseChatCommand("! spaced")).toBeNull();
    expect(parseChatCommand("plain message")).toBeNull();
  });
});
