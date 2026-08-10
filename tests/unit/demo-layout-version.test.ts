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

  it("offers a members box alongside the subscriber goal box", () => {
    expect(DEFAULT_DEMO_LAYOUT.boxes).toHaveProperty("members");
    expect(DEFAULT_DEMO_LAYOUT.boxes).toHaveProperty("goalSubs");
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

  it("keeps the subscriber goal box the owner had placed", () => {
    const merged = mergeDemoLayout(saved);
    expect(merged.boxes.goalSubs).toEqual({ x: 900, y: 1500, scale: 4 });
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

// Messages are stored in the same value as hand-set positions, which are
// expensive to redo. Adding a message must never cost the owner their layout.
describe("messages ride alongside the layout without disturbing it", () => {
  const PLACED = {
    goalLikes: { x: 11, y: 22, scale: 1.5 },
    members: { x: 200, y: 300, scale: 1.25 },
    competition: { x: 55, y: 66, scale: 0.8 },
  };

  const saved = {
    version: DEMO_LAYOUT_VERSION,
    boxes: { ...DEFAULT_DEMO_LAYOUT.boxes, ...PLACED },
    visible: { ...DEFAULT_DEMO_LAYOUT.visible, goalLikes: false, break: true },
    boxOpacity: { ...DEFAULT_DEMO_LAYOUT.boxOpacity, members: 0.42 },
  } as unknown as Parameters<typeof mergeDemoLayout>[0];

  const FIRST = { text: "first thing", align: "left" as const };
  const SECOND = { text: "second thing", align: "center" as const };
  const DEFAULT_MESSAGES = [
    { text: "Chat to become a member at Vids.Tube!", align: "left" },
  ];

  const withMessages = {
    ...saved,
    messages: [FIRST, SECOND],
  } as unknown as Parameters<typeof mergeDemoLayout>[0];

  it("keeps every position and scale once messages are added", () => {
    const merged = mergeDemoLayout(withMessages);
    expect(merged.boxes.goalLikes).toEqual(PLACED.goalLikes);
    expect(merged.boxes.members).toEqual(PLACED.members);
    expect(merged.boxes.competition).toEqual(PLACED.competition);
  });

  it("keeps every toggle and opacity once messages are added", () => {
    const merged = mergeDemoLayout(withMessages);
    expect(merged.visible.goalLikes).toBe(false);
    expect(merged.visible.break).toBe(true);
    expect(merged.boxOpacity.members).toBe(0.42);
  });

  it("changes nothing but the messages", () => {
    expect(mergeDemoLayout(withMessages)).toEqual({
      ...mergeDemoLayout(saved),
      messages: [FIRST, SECOND],
    });
  });

  it("keeps the messages in the order the streamer set", () => {
    expect(mergeDemoLayout(withMessages).messages).toEqual([FIRST, SECOND]);
  });

  it("keeps the alignment the streamer chose for each message", () => {
    const merged = mergeDemoLayout(withMessages);
    expect(merged.messages[0].align).toBe("left");
    expect(merged.messages[1].align).toBe("center");
  });

  it("gives a layout saved before messages existed the old sentence", () => {
    expect(mergeDemoLayout(saved).messages).toEqual(DEFAULT_MESSAGES);
  });

  it("falls back to the old sentence when the list is empty", () => {
    const merged = mergeDemoLayout({
      ...saved,
      messages: [],
    } as unknown as Parameters<typeof mergeDemoLayout>[0]);
    expect(merged.messages).toEqual(DEFAULT_MESSAGES);
  });

  it("drops entries that are not text rather than rendering a blank", () => {
    const merged = mergeDemoLayout({
      ...saved,
      messages: [FIRST, { text: "  " }, 7, null, { align: "center" }],
    } as unknown as Parameters<typeof mergeDemoLayout>[0]);
    expect(merged.messages).toEqual([FIRST]);
  });

  // Alignment arrived after the messages did, so a message stored as a bare
  // string is read as the left-aligned line it was.
  it("reads a message saved as plain text as a left-aligned message", () => {
    const merged = mergeDemoLayout({
      ...saved,
      messages: ["written before alignment existed"],
    } as unknown as Parameters<typeof mergeDemoLayout>[0]);
    expect(merged.messages).toEqual([
      { text: "written before alignment existed", align: "left" },
    ]);
  });

  it("reads an unknown alignment as the left it can actually draw", () => {
    const merged = mergeDemoLayout({
      ...saved,
      messages: [{ text: "sideways", align: "diagonal" }],
    } as unknown as Parameters<typeof mergeDemoLayout>[0]);
    expect(merged.messages[0].align).toBe("left");
  });

  it("falls back rather than crashing when the list is nonsense", () => {
    const merged = mergeDemoLayout({
      ...saved,
      messages: "not a list",
    } as unknown as Parameters<typeof mergeDemoLayout>[0]);
    expect(merged.messages).toEqual(DEFAULT_MESSAGES);
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
