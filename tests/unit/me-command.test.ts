import { describe, expect, it } from "vitest";
import {
  clipSample,
  needsRegeneration,
  type MeStats,
} from "@/worker/lib/me-command";

const stats: MeStats = {
  totalMessages: 100,
  videosAttended: 10,
  firstSeenAt: "2025-11-18T00:00:00Z",
  vidstubeScore: 5,
  vidstubeFeatures: 1,
  vidstubeStreams: 2,
};

const snapshot = { totalMessages: 100, videosAttended: 10 };

describe("needsRegeneration", () => {
  it("regenerates with no snapshot", () => {
    expect(needsRegeneration(null, stats)).toBe(true);
  });

  it("serves the cache when stats are stable and the bio is from this stream", () => {
    expect(
      needsRegeneration(
        snapshot,
        stats,
        "2026-07-18T10:00:00Z",
        "2026-07-18T09:00:00Z"
      )
    ).toBe(false);
  });

  it("regenerates when the bio predates the current stream", () => {
    expect(
      needsRegeneration(
        snapshot,
        stats,
        "2026-07-17T10:00:00Z",
        "2026-07-18T09:00:00Z"
      )
    ).toBe(true);
  });

  it("regenerates when generated_at is missing but a stream start is known", () => {
    expect(
      needsRegeneration(snapshot, stats, null, "2026-07-18T09:00:00Z")
    ).toBe(true);
  });

  it("keeps the 20-message delta rule", () => {
    expect(
      needsRegeneration(
        { totalMessages: 80, videosAttended: 10 },
        stats,
        "2026-07-18T10:00:00Z",
        "2026-07-18T09:00:00Z"
      )
    ).toBe(true);
  });

  it("keeps the attended-count rule", () => {
    expect(
      needsRegeneration(
        { totalMessages: 100, videosAttended: 9 },
        stats,
        "2026-07-18T10:00:00Z",
        "2026-07-18T09:00:00Z"
      )
    ).toBe(true);
  });
});

describe("clipSample", () => {
  it("passes short messages through with whitespace collapsed", () => {
    expect(clipSample("hello   there\nfriend")).toBe("hello there friend");
  });

  it("clips long messages to 120 chars with an ellipsis", () => {
    const out = clipSample("x".repeat(300));
    expect(out.length).toBe(120);
    expect(out.endsWith("…")).toBe(true);
  });
});
