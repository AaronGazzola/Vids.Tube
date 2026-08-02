import { describe, expect, it } from "vitest";
import { ECHO_PREFIX_CHARS, echoKey, isEchoOf, normaliseForEcho } from "@/lib/bot-echo";

const LONG =
  "@AzAnything AzAnything has been part of the community since June 2025 and has shown up for an impressive 106 streams, which is more than almost anyone else here.";

describe("normaliseForEcho", () => {
  it("strips the zero-width characters Nightbot prepends", () => {
    expect(normaliseForEcho("​​hello there")).toBe("hello there");
  });

  it("collapses whitespace and folds case", () => {
    expect(normaliseForEcho("  Hello   THERE  ")).toBe("hello there");
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
