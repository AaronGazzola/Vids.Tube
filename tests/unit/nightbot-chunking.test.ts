import { describe, expect, it } from "vitest";
import { chunkForYoutube } from "@/worker/lib/replies";

describe("chunkForYoutube", () => {
  it("returns a single unmarked message when within the limit", () => {
    expect(chunkForYoutube("hello there")).toEqual(["hello there"]);
  });

  it("returns a single unmarked message at exactly 400 chars", () => {
    const text = "a".repeat(400);
    expect(chunkForYoutube(text)).toEqual([text]);
  });

  it("splits a long message into marked parts on whitespace", () => {
    const text = Array.from({ length: 120 }, (_, i) => `word${i}`).join(" ");
    const parts = chunkForYoutube(text);
    expect(parts.length).toBeGreaterThan(1);
    for (const part of parts) {
      expect(part.length).toBeLessThanOrEqual(400);
    }
    parts.forEach((part, i) => {
      expect(part.endsWith(`(${i + 1}/${parts.length})`)).toBe(true);
    });
    expect(parts.join(" ")).toContain("word0");
    expect(parts.join(" ")).toContain("word119");
  });

  it("caps at 3 parts and ellipsis-truncates the last", () => {
    const text = Array.from({ length: 400 }, (_, i) => `word${i}`).join(" ");
    const parts = chunkForYoutube(text);
    expect(parts).toHaveLength(3);
    for (const part of parts) {
      expect(part.length).toBeLessThanOrEqual(400);
    }
    expect(parts[2]).toMatch(/…\s*\(3\/3\)$/);
  });

  it("hard-splits a single word longer than the budget", () => {
    const text = "x".repeat(900);
    const parts = chunkForYoutube(text);
    expect(parts.length).toBeGreaterThan(1);
    for (const part of parts) {
      expect(part.length).toBeLessThanOrEqual(400);
    }
  });
});
