import { describe, expect, it } from "vitest";
import { ensureUniqueHandle, normalizeHandleBase } from "@/lib/channel-handle";

describe("normalizeHandleBase", () => {
  it("strips a leading at sign and lowercases", () => {
    expect(normalizeHandleBase("@AzAnything")).toBe("azanything");
  });

  it("replaces spaces and punctuation with single underscores", () => {
    expect(normalizeHandleBase("Palantlial Car Detailing!")).toBe(
      "palantlial_car_detailing"
    );
  });

  it("trims underscores from both ends", () => {
    expect(normalizeHandleBase("  ...bob...  ")).toBe("bob");
  });

  it("pads a name shorter than three characters", () => {
    expect(normalizeHandleBase("jo")).toHaveLength(3);
    expect(normalizeHandleBase("jo")).toBe("jo0");
  });

  it("falls back when a name has nothing usable in it", () => {
    expect(normalizeHandleBase("!!!")).toBe("user");
  });

  it("truncates to thirty characters", () => {
    expect(normalizeHandleBase("a".repeat(60))).toHaveLength(30);
  });

  it("is stable across repeated calls", () => {
    const once = normalizeHandleBase("Some Chatter Name");
    expect(normalizeHandleBase("Some Chatter Name")).toBe(once);
  });
});

describe("ensureUniqueHandle", () => {
  it("keeps the base when nothing has taken it", () => {
    expect(ensureUniqueHandle("chatter", new Set())).toBe("chatter");
  });

  it("suffixes a taken base", () => {
    expect(ensureUniqueHandle("chatter", new Set(["chatter"]))).toBe("chatter_2");
  });

  it("keeps suffixing until it finds a free handle", () => {
    const taken = new Set(["chatter", "chatter_2", "chatter_3"]);
    expect(ensureUniqueHandle("chatter", taken)).toBe("chatter_4");
  });

  it("stays within thirty characters when suffixing a long base", () => {
    const base = "a".repeat(30);
    const result = ensureUniqueHandle(base, new Set([base]));
    expect(result.length).toBeLessThanOrEqual(30);
    expect(result.endsWith("_2")).toBe(true);
  });

  it("never returns a reserved route word", () => {
    const result = ensureUniqueHandle("live", new Set());
    expect(result).not.toBe("live");
  });

  it("records what it hands out so the next caller cannot collide", () => {
    const taken = new Set<string>();
    const first = ensureUniqueHandle("chatter", taken);
    const second = ensureUniqueHandle("chatter", taken);
    expect(first).not.toBe(second);
  });
});
