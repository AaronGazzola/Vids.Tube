import {
  anchorPoint,
  clampScale,
  cornerPoint,
  holdScaleWhileDragging,
  OVERLAY_SCALE_MAX,
  OVERLAY_SCALE_MIN,
  resizeFromCorner,
  type ResizeCorner,
} from "@/lib/overlay-resize";
import { describe, expect, it } from "vitest";

const W = 200;
const H = 100;
const START = { x: 300, y: 400, scale: 1 };

const CORNERS: ResizeCorner[] = ["tl", "tr", "bl", "br"];

describe("resizeFromCorner", () => {
  it("keeps the opposite corner fixed for every handle", () => {
    for (const corner of CORNERS) {
      const anchor = anchorPoint(corner, START, W, H);
      const dragged = cornerPoint(corner, START, W, H);
      const pointer = {
        x: anchor.x + (dragged.x - anchor.x) * 1.5,
        y: anchor.y + (dragged.y - anchor.y) * 1.5,
      };

      const next = resizeFromCorner({
        corner,
        startBox: START,
        width: W,
        height: H,
        pointerCanvas: pointer,
      });

      const movedAnchor = anchorPoint(corner, next, W, H);
      expect(movedAnchor.x).toBeCloseTo(anchor.x, 6);
      expect(movedAnchor.y).toBeCloseTo(anchor.y, 6);
    }
  });

  it("changes width and height in the same proportion", () => {
    const next = resizeFromCorner({
      corner: "br",
      startBox: START,
      width: W,
      height: H,
      pointerCanvas: { x: START.x + W * 2, y: START.y + H * 2 },
    });

    const widthRatio = (W * next.scale) / (W * START.scale);
    const heightRatio = (H * next.scale) / (H * START.scale);
    expect(widthRatio).toBeCloseTo(heightRatio, 10);
    expect(next.scale).toBeCloseTo(2, 6);
  });

  it("grows about the top-left when the bottom-right handle is dragged out", () => {
    const next = resizeFromCorner({
      corner: "br",
      startBox: START,
      width: W,
      height: H,
      pointerCanvas: { x: START.x + W * 3, y: START.y + H * 3 },
    });

    expect(next.x).toBe(START.x);
    expect(next.y).toBe(START.y);
    expect(next.scale).toBeGreaterThan(START.scale);
  });

  it("moves the origin when the top-left handle is dragged out", () => {
    const anchor = anchorPoint("tl", START, W, H);
    const next = resizeFromCorner({
      corner: "tl",
      startBox: START,
      width: W,
      height: H,
      pointerCanvas: { x: START.x - W, y: START.y - H },
    });

    expect(next.scale).toBeGreaterThan(START.scale);
    expect(next.x).toBeLessThan(START.x);
    expect(next.y).toBeLessThan(START.y);
    expect(next.x + W * next.scale).toBeCloseTo(anchor.x, 6);
    expect(next.y + H * next.scale).toBeCloseTo(anchor.y, 6);
  });

  it("clamps at both bounds", () => {
    const anchor = anchorPoint("br", START, W, H);

    const huge = resizeFromCorner({
      corner: "br",
      startBox: START,
      width: W,
      height: H,
      pointerCanvas: { x: anchor.x + W * 1000, y: anchor.y + H * 1000 },
    });
    expect(huge.scale).toBe(OVERLAY_SCALE_MAX);

    const tiny = resizeFromCorner({
      corner: "br",
      startBox: START,
      width: W,
      height: H,
      pointerCanvas: { x: anchor.x, y: anchor.y },
    });
    expect(tiny.scale).toBe(OVERLAY_SCALE_MIN);
  });

  it("returns the box unchanged when it has not been measured yet", () => {
    expect(
      resizeFromCorner({
        corner: "br",
        startBox: START,
        width: 0,
        height: 0,
        pointerCanvas: { x: 1, y: 1 },
      })
    ).toBe(START);
  });
});

describe("clampScale", () => {
  it("holds the configured bounds", () => {
    expect(clampScale(0.1)).toBe(OVERLAY_SCALE_MIN);
    expect(clampScale(99)).toBe(OVERLAY_SCALE_MAX);
    expect(clampScale(1.5)).toBe(1.5);
  });
});

describe("holdScaleWhileDragging", () => {
  it("only grows while a drag is in progress", () => {
    expect(holdScaleWhileDragging(1, 2, true)).toBe(2);
    expect(holdScaleWhileDragging(2, 1, true)).toBe(2);
  });

  it("settles to the real scale once the drag ends", () => {
    expect(holdScaleWhileDragging(2, 1, false)).toBe(1);
  });
});
