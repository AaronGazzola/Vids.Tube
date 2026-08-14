import { BANNER_METRIC_KINDS } from "@/app/(app)/live/demo.types";
import type { GoalProgressResponse } from "@/app/layout.types";
import { resolveBannerMetrics } from "@/lib/banner-metrics";
import { describe, expect, it } from "vitest";

const progress = (current: number, total: number) => ({
  current,
  target: 100,
  total,
  goal: 100,
  pct: current / 100,
  reached: false,
});

const LIVE: GoalProgressResponse = {
  active: true,
  isLive: true,
  targets: { subs: 100, likes: 100, viewers: 100 },
  metrics: {
    subs: progress(37, 4820),
    likes: progress(214, 214),
    viewers: progress(63, 63),
  },
};

const OFF_AIR: GoalProgressResponse = {
  active: false,
  isLive: false,
  targets: { subs: 100, likes: 100, viewers: 100 },
  metrics: null,
};

const COUNTS = {
  memberCount: 143,
  totalChatters: 512,
  totalCommands: 1840,
  newMembersThisStream: 9,
};

describe("resolveBannerMetrics", () => {
  it("resolves every kind while live", () => {
    const values = resolveBannerMetrics({ goals: LIVE, ...COUNTS });
    for (const kind of BANNER_METRIC_KINDS) {
      expect(values[kind], `${kind} was not resolved`).not.toBeNull();
    }
  });

  it("reads each number from the right place", () => {
    const values = resolveBannerMetrics({ goals: LIVE, ...COUNTS });
    // The channel total, not the gain.
    expect(values.totalSubs).toBe(4820);
    // The gain since this broadcast started, which is what the goal bar shows.
    expect(values.newSubsThisStream).toBe(37);
    expect(values.likesThisStream).toBe(214);
    expect(values.currentViewers).toBe(63);
    expect(values.totalChatters).toBe(512);
    expect(values.totalCommands).toBe(1840);
    expect(values.members).toBe(143);
    expect(values.newMembersThisStream).toBe(9);
  });

  it("gives a per-stream kind no value off air, rather than a zero", () => {
    const values = resolveBannerMetrics({
      goals: OFF_AIR,
      ...COUNTS,
      newMembersThisStream: null,
    });
    expect(values.totalSubs).toBeNull();
    expect(values.newSubsThisStream).toBeNull();
    expect(values.likesThisStream).toBeNull();
    expect(values.currentViewers).toBeNull();
    expect(values.newMembersThisStream).toBeNull();
  });

  it("keeps the lifetime kinds off air, since they do not need a broadcast", () => {
    const values = resolveBannerMetrics({ goals: OFF_AIR, ...COUNTS });
    expect(values.members).toBe(143);
    expect(values.totalChatters).toBe(512);
    expect(values.totalCommands).toBe(1840);
  });

  it("treats a count that has not loaded as absent rather than zero", () => {
    const values = resolveBannerMetrics({
      goals: OFF_AIR,
      memberCount: undefined,
      totalChatters: undefined,
      totalCommands: undefined,
      newMembersThisStream: undefined,
    });
    expect(values.members).toBeNull();
    expect(values.totalChatters).toBeNull();
    expect(values.totalCommands).toBeNull();
  });

  it("resolves a real zero as zero, not as absent", () => {
    const values = resolveBannerMetrics({
      goals: OFF_AIR,
      ...COUNTS,
      memberCount: 0,
    });
    expect(values.members).toBe(0);
  });
});
