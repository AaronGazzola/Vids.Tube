import { beforeEach, describe, expect, it } from "vitest";
import { isRecentSend, noteRecentSend, resetRecentSends } from "../../worker/lib/replies";
import { ECHO_PREFIX_CHARS, echoKey, isEchoOf, normaliseForEcho } from "@/lib/bot-echo";

const LONG =
  "@AzAnything AzAnything has been part of the community since June 2025 and has shown up for an impressive 106 streams, which is more than almost anyone else here.";

describe("normaliseForEcho", () => {
  it("strips the zero-width characters Nightbot prepends", () => {
    expect(normaliseForEcho("​​hello there")).toBe("hellothere");
  });

  it("removes whitespace and folds case", () => {
    expect(normaliseForEcho("  Hello   THERE  ")).toBe("hellothere");
  });

  it("reduces an empty message to nothing", () => {
    expect(normaliseForEcho("   ")).toBe("");
  });
});

describe("echoKey", () => {
  it("compares on a prefix shorter than the platform limit", () => {
    expect(ECHO_PREFIX_CHARS).toBeLessThan(200);
    expect(echoKey(LONG)).toHaveLength(ECHO_PREFIX_CHARS);
  });

  it("gives an empty message an empty key", () => {
    expect(echoKey("")).toBe("");
  });
});

describe("isEchoOf", () => {
  it("recognises a reply that came back truncated to the platform limit", () => {
    expect(isEchoOf(LONG, LONG.slice(0, 200))).toBe(true);
  });

  it("recognises a reply that came back with zero-width padding", () => {
    expect(isEchoOf(LONG, `​​${LONG.slice(0, 200)}`)).toBe(true);
  });

  it("recognises a reply whose whitespace or case was rewritten", () => {
    expect(isEchoOf("Shipped Nightbot chunking", "shipped  nightbot   chunking")).toBe(true);
  });

  // Captured from the 8-Aug-2026 broadcast, where both of these were stored a
  // second time because the newline came back deleted rather than collapsed.
  it("recognises a reply whose newline was deleted rather than collapsed", () => {
    expect(
      isEchoOf(
        "You can clone all my skills from my public AI Resources repository:\nhttps://github.com/AaronGazzola/AI-Resources",
        "​​You can clone all my skills from my public AI Resources repository:https://github.com/AaronGazzola/AI-Resources"
      )
    ).toBe(true);
  });

  it("recognises a multi-line announcement that came back on one line", () => {
    expect(
      isEchoOf(
        "Topic of the day:\nRight more often. Wrong more confidently.\nTopic chat link below",
        "Topic of the day:Right more often. Wrong more confidently.Topic chat link below"
      )
    ).toBe(true);
  });

  it("does not mistake another bot's message for the worker's", () => {
    expect(isEchoOf(LONG, "Follow the channel for more vibe coding!")).toBe(false);
  });

  it("does not match when one side is empty", () => {
    expect(isEchoOf("", "anything")).toBe(false);
    expect(isEchoOf("anything", "")).toBe(false);
  });

  it("distinguishes two replies that differ only after the prefix", () => {
    const base = "a".repeat(ECHO_PREFIX_CHARS);
    expect(isEchoOf(`${base}one`, `${base}two`)).toBe(true);
  });

  it("distinguishes two replies that differ within the prefix", () => {
    expect(isEchoOf("the first reply", "the second reply")).toBe(false);
  });
});

describe("recent-send memory", () => {
  beforeEach(() => {
    resetRecentSends();
  });

  it("still recognises a send whose echo arrives after the consuming memory gave it up", () => {
    noteRecentSend("welcome back, good to see you", 1000);
    expect(isRecentSend("welcome back, good to see you", 1000)).toBe(true);
  });

  it("recognises an echo that arrives minutes late", () => {
    noteRecentSend("welcome back, good to see you", 0);
    expect(isRecentSend("welcome back, good to see you", 10 * 60 * 1000)).toBe(true);
  });

  it("forgets a send once the window has passed, so a later repeat is its own message", () => {
    noteRecentSend("topic of the day", 0);
    expect(isRecentSend("topic of the day", 16 * 60 * 1000)).toBe(false);
  });

  it("does not treat another bot's message as one of ours", () => {
    noteRecentSend("welcome back, good to see you", 1000);
    expect(isRecentSend("follow the channel for more vibe coding", 1000)).toBe(false);
  });

  it("matches a seeded send whose newline the transport deleted", () => {
    noteRecentSend("Topic of the day:\nRight more often.", 0);
    expect(isRecentSend("Topic of the day:Right more often.", 60_000)).toBe(true);
  });
});
