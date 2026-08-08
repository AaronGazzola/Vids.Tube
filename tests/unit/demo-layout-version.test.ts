import { describe, expect, it } from "vitest";
import {
  DEFAULT_DEMO_LAYOUT,
  DEMO_LAYOUT_VERSION,
  mergeDemoLayout,
} from "@/app/(app)/live/demo.types";

describe("overlay layout version 3", () => {
  it("is version 3, because the members strip replaced the subscriber goal box", () => {
    expect(DEMO_LAYOUT_VERSION).toBe(3);
  });

  it("offers a members box and no subscriber goal box", () => {
    expect(DEFAULT_DEMO_LAYOUT.boxes).toHaveProperty("members");
    expect(DEFAULT_DEMO_LAYOUT.boxes).not.toHaveProperty("goalSubs");
    expect(DEFAULT_DEMO_LAYOUT.visible).toHaveProperty("members");
  });

  it("leaves the likes and viewers goals in place", () => {
    expect(DEFAULT_DEMO_LAYOUT.boxes).toHaveProperty("goalLikes");
    expect(DEFAULT_DEMO_LAYOUT.boxes).toHaveProperty("goalViewers");
  });
});

// Positions are hard-won. A version bump must migrate them, never discard them:
// every box the owner placed keeps its coordinates unless that specific box's
// coordinates changed meaning.
describe("a layout saved before the change keeps every position it had", () => {
  const PLACED = {
    goalLikes: { x: 11, y: 22, scale: 1.5 },
    goalViewers: { x: 33, y: 44, scale: 2.25 },
    competition: { x: 55, y: 66, scale: 0.8 },
    highlight: { x: 77, y: 88, scale: 3 },
    break: { x: 99, y: 111, scale: 1.1 },
  };

  const saved = {
    version: 2,
    boxes: {
      goalSubs: { x: 900, y: 1500, scale: 4 },
      ...PLACED,
    },
    visible: {
      goalSubs: false,
      goalLikes: false,
      goalViewers: true,
      competition: true,
      highlight: true,
      tts: false,
      ask: true,
      break: true,
    },
    boxOpacity: { competition: 0.35, highlight: 0.9 },
  } as unknown as Parameters<typeof mergeDemoLayout>[0];

  it("keeps every box the owner had placed", () => {
    const merged = mergeDemoLayout(saved);
    expect(merged.boxes.goalLikes).toEqual(PLACED.goalLikes);
    expect(merged.boxes.goalViewers).toEqual(PLACED.goalViewers);
    expect(merged.boxes.competition).toEqual(PLACED.competition);
    expect(merged.boxes.highlight).toEqual(PLACED.highlight);
    expect(merged.boxes.break).toEqual(PLACED.break);
  });

  it("does not silently fall back to the defaults", () => {
    const merged = mergeDemoLayout(saved);
    expect(merged.boxes).not.toEqual(DEFAULT_DEMO_LAYOUT.boxes);
  });

  it("gives the newly added members strip its default position", () => {
    const merged = mergeDemoLayout(saved);
    expect(merged.boxes.members).toEqual(DEFAULT_DEMO_LAYOUT.boxes.members);
  });

  it("drops the box that no longer exists", () => {
    const merged = mergeDemoLayout(saved);
    expect(merged.boxes).not.toHaveProperty("goalSubs");
  });

  it("keeps the toggles and the opacities the owner had chosen", () => {
    const merged = mergeDemoLayout(saved);
    expect(merged.visible.goalLikes).toBe(false);
    expect(merged.visible.tts).toBe(false);
    expect(merged.visible.break).toBe(true);
    expect(merged.boxOpacity.competition).toBe(0.35);
    expect(merged.boxOpacity.highlight).toBe(0.9);
  });

  it("reports itself as the current version afterwards", () => {
    expect(mergeDemoLayout(saved).version).toBe(DEMO_LAYOUT_VERSION);
  });
});

describe("guards around a saved layout", () => {
  it("keeps positions from a layout already on the current version", () => {
    const members = { x: 200, y: 300, scale: 1.25 };
    const merged = mergeDemoLayout({
      version: DEMO_LAYOUT_VERSION,
      boxes: { ...DEFAULT_DEMO_LAYOUT.boxes, members },
    });
    expect(merged.boxes.members).toEqual(members);
  });

  it("keeps positions from a layout carrying no version at all", () => {
    const competition = { x: 12, y: 34, scale: 2 };
    const merged = mergeDemoLayout({
      boxes: { competition },
    } as unknown as Parameters<typeof mergeDemoLayout>[0]);
    expect(merged.boxes.competition).toEqual(competition);
  });

  it("falls back for a box saved as nonsense rather than crashing", () => {
    const merged = mergeDemoLayout({
      version: DEMO_LAYOUT_VERSION,
      boxes: { competition: { x: "left", y: null } },
    } as unknown as Parameters<typeof mergeDemoLayout>[0]);
    expect(merged.boxes.competition).toEqual(
      DEFAULT_DEMO_LAYOUT.boxes.competition
    );
  });

  it("returns the defaults when nothing was saved", () => {
    expect(mergeDemoLayout(null)).toEqual(DEFAULT_DEMO_LAYOUT);
  });

  it("always returns every box key", () => {
    const merged = mergeDemoLayout({
      version: 2,
      boxes: {},
    } as unknown as Parameters<typeof mergeDemoLayout>[0]);
    expect(Object.keys(merged.boxes).sort()).toEqual(
      Object.keys(DEFAULT_DEMO_LAYOUT.boxes).sort()
    );
  });
});
