import { describe, expect, it } from "vitest";
import { chunkForYoutube } from "@/worker/lib/replies";

// YouTube live chat accepts 200 characters. The budget used to be 400, so every
// long reply arrived cut in half with its continuation marker missing.
const LIMIT = 200;

describe("chunkForYoutube", () => {
  it("returns a single unmarked message when within the limit", () => {
    expect(chunkForYoutube("hello there")).toEqual(["hello there"]);
  });

  it("returns a single unmarked message at exactly the limit", () => {
    const text = "a".repeat(LIMIT);
    expect(chunkForYoutube(text)).toEqual([text]);
  });

  it("splits one character over the limit", () => {
    const parts = chunkForYoutube("a".repeat(LIMIT + 1));
    expect(parts.length).toBeGreaterThan(1);
  });

  it("keeps every chunk within the limit, marker included", () => {
    const text = Array.from({ length: 120 }, (_, i) => `word${i}`).join(" ");
    const parts = chunkForYoutube(text);
    expect(parts.length).toBeGreaterThan(1);
    for (const part of parts) {
      expect(part.length).toBeLessThanOrEqual(LIMIT);
    }
  });

  it("marks each chunk with its position", () => {
    const text = Array.from({ length: 120 }, (_, i) => `word${i}`).join(" ");
    const parts = chunkForYoutube(text);
    parts.forEach((part, i) => {
      expect(part.endsWith(`(${i + 1}/${parts.length})`)).toBe(true);
    });
  });

  it("starts at the beginning of the reply", () => {
    const text = Array.from({ length: 120 }, (_, i) => `word${i}`).join(" ");
    expect(chunkForYoutube(text)[0]).toContain("word0");
  });

  it("breaks on a word rather than mid-word", () => {
    const text = Array.from({ length: 120 }, (_, i) => `word${i}`).join(" ");
    for (const part of chunkForYoutube(text)) {
      const body = part.replace(/\s*\(\d+\/\d+\)$/, "").replace(/…$/, "").trim();
      expect(body).toMatch(/(^|\s)word\d+$/);
    }
  });

  it("caps at 3 parts and marks the last as clipped", () => {
    const text = Array.from({ length: 400 }, (_, i) => `word${i}`).join(" ");
    const parts = chunkForYoutube(text);
    expect(parts).toHaveLength(3);
    for (const part of parts) {
      expect(part.length).toBeLessThanOrEqual(LIMIT);
    }
    expect(parts[2]).toMatch(/…\s*\(3\/3\)$/);
  });

  it("hard-splits a single word longer than the budget", () => {
    const parts = chunkForYoutube("x".repeat(900));
    expect(parts.length).toBeGreaterThan(1);
    for (const part of parts) {
      expect(part.length).toBeLessThanOrEqual(LIMIT);
    }
  });
});
