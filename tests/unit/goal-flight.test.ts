import { riseBadge } from "@/components/overlay/goal-rise-flyer";
import {
  goalDiameter,
  OVERLAY_CANVAS_CENTRE,
  OVERLAY_GOAL_HEIGHT,
} from "@/lib/demo-overlay";
import { goalFlightDelta } from "@/lib/goal-flight";
import { announceRise } from "@/lib/goal-flights";
import { describe, expect, it } from "vitest";

const R = goalDiameter(OVERLAY_GOAL_HEIGHT) / 2;

describe("goalFlightDelta", () => {
  it("travels nowhere when the goal already sits at the centre", () => {
    const box = {
      x: OVERLAY_CANVAS_CENTRE.x - R,
      y: OVERLAY_CANVAS_CENTRE.y - R,
      scale: 1,
    };
    expect(goalFlightDelta(box, OVERLAY_GOAL_HEIGHT)).toEqual({ dx: 0, dy: 0 });
  });

  it("aims at the goal's centre, not its corner", () => {
    const box = { x: 0, y: 0, scale: 1 };
    const { dx, dy } = goalFlightDelta(box, OVERLAY_GOAL_HEIGHT);
    // Half a diameter short of the canvas centre in each direction.
    expect(dx).toBe(R - OVERLAY_CANVAS_CENTRE.x);
    expect(dy).toBe(R - OVERLAY_CANVAS_CENTRE.y);
  });

  it("accounts for the scale the streamer set", () => {
    const box = { x: 100, y: 100, scale: 2 };
    const { dx } = goalFlightDelta(box, OVERLAY_GOAL_HEIGHT);
    // A box scaled from its top-left corner has its centre twice as far in.
    expect(dx).toBe(100 + R * 2 - OVERLAY_CANVAS_CENTRE.x);
  });

  it("follows a goal the streamer moves", () => {
    const near = goalFlightDelta({ x: 500, y: 900, scale: 1 });
    const far = goalFlightDelta({ x: 40, y: 1700, scale: 1 });
    expect(far.dx).toBeLessThan(near.dx);
    expect(far.dy).toBeGreaterThan(near.dy);
  });
});

describe("riseBadge", () => {
  it("announces the increment for subs", () => {
    expect(riseBadge("subs", 1, 4821)).toBe("+1");
  });

  it("announces the increment for likes", () => {
    expect(riseBadge("likes", 1, 215)).toBe("+1");
  });

  it("announces the total for viewers, which is a level rather than a tally", () => {
    expect(riseBadge("viewers", 1, 63)).toBe("63");
  });

  it("groups a jump into one announcement for subs", () => {
    expect(riseBadge("subs", 3, 4823)).toBe("+3");
  });

  it("reads large numbers with separators", () => {
    expect(riseBadge("viewers", 1, 12345)).toBe("12,345");
  });
});

describe("announceRise", () => {
  it("announces every subscriber", () => {
    expect(announceRise("subs", 40, 41, 1000)).toBe(true);
  });

  it("announces every like", () => {
    expect(announceRise("likes", 214, 215, 500)).toBe(true);
  });

  it("stays quiet while viewers climb below the goal", () => {
    expect(announceRise("viewers", 40, 41, 100)).toBe(false);
  });

  it("announces the moment viewers reach the goal", () => {
    expect(announceRise("viewers", 99, 100, 100)).toBe(true);
  });

  it("announces a jump straight past the goal", () => {
    expect(announceRise("viewers", 80, 140, 100)).toBe(true);
  });

  it("does not announce again while viewers stay above the goal", () => {
    expect(announceRise("viewers", 120, 130, 100)).toBe(false);
  });

  it("announces again after viewers drop below and come back", () => {
    expect(announceRise("viewers", 90, 105, 100)).toBe(true);
  });

  it("stays quiet when no viewers goal is set", () => {
    expect(announceRise("viewers", 10, 20, null)).toBe(false);
    expect(announceRise("viewers", 10, 20, 0)).toBe(false);
  });
});
