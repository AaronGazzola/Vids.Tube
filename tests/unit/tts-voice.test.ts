import { describe, expect, it } from "vitest";
import { TTS_VOICES, seedVoice, splitVoiceToken } from "@/worker/lib/tts";

describe("splitVoiceToken", () => {
  it("strips a leading voice name and keeps the rest", () => {
    expect(splitVoiceToken("evil say hello")).toEqual({
      voice: "evil",
      text: "say hello",
    });
  });

  it("matches a voice name case-insensitively and stores the catalog casing", () => {
    expect(splitVoiceToken("VICTORIA hi")).toEqual({
      voice: "Victoria",
      text: "hi",
    });
  });

  it("keeps an unmatched first word in the message so moderation still sees it", () => {
    expect(splitVoiceToken("wizard say hello")).toEqual({
      voice: null,
      text: "wizard say hello",
    });
  });

  it("treats a lone voice name as a voice with no message", () => {
    expect(splitVoiceToken("  DJ  ")).toEqual({ voice: "DJ", text: "" });
  });
});

describe("seedVoice", () => {
  it("returns a catalog voice", () => {
    expect(Object.keys(TTS_VOICES)).toContain(seedVoice(["youtube:UCabc"]));
  });

  it("gives linked identities the same voice whichever chat is used", () => {
    const fromYoutube = seedVoice(["youtube:UCabc", "user-1"]);
    const fromSite = seedVoice(["user-1", "youtube:UCabc"]);
    expect(fromYoutube).toBe(fromSite);
  });

  it("spreads different chatters across the catalog", () => {
    const picks = new Set(
      Array.from({ length: 40 }, (_, i) => seedVoice([`youtube:UC${i}`]))
    );
    expect(picks.size).toBeGreaterThan(1);
  });
});
