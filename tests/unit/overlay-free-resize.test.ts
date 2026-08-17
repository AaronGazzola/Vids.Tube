import { describe, expect, it } from "vitest";
import {
  OVERLAY_MIN_EXTENT,
  boxExtent,
  resizeFreeFromCorner,
  resizeFromCorner,
  resizeFromEdge,
} from "@/lib/overlay-resize";
import type { DemoBox } from "@/app/(app)/live/demo.types";

// The content's natural size, which a box that has never been resized is scaled
// against.
const W = 480;
const H = 320;

const sized: DemoBox = { x: 100, y: 200, scale: 1, w: 480, h: 320 };
const unsized: DemoBox = { x: 100, y: 200, scale: 2 };

describe("a box that has not been freely resized", () => {
  it("still measures as its content scaled, so nothing about it has changed", () => {
    expect(boxExtent(unsized, W, H)).toEqual({ w: 960, h: 640 });
  });

  it("measures by its own width and height once it carries them", () => {
    expect(boxExtent(sized, W, H)).toEqual({ w: 480, h: 320 });
  });
});

describe("free resize from a corner", () => {
  it("changes both dimensions independently, so aspect ratio is not preserved", () => {
    const next = resizeFreeFromCorner({
      corner: "br",
      startBox: sized,
      width: W,
      height: H,
      pointerCanvas: { x: 100 + 300, y: 200 + 600 },
    });
    expect(next.w).toBe(300);
    expect(next.h).toBe(600);
    // 480x320 was 1.5 wide; 300x600 is 0.5. A uniform resize could not do this.
    expect(next.w! / next.h!).not.toBeCloseTo(sized.w! / sized.h!);
  });

  it("leaves the anchor corner exactly where it was", () => {
    const next = resizeFreeFromCorner({
      corner: "tl",
      startBox: sized,
      width: W,
      height: H,
      pointerCanvas: { x: 40, y: 90 },
    });
    // Dragging the top-left anchors the bottom-right, which was at (580, 520).
    expect(next.x + next.w!).toBeCloseTo(580);
    expect(next.y + next.h!).toBeCloseTo(520);
  });

  it("does not change the scale, which free resize does not use", () => {
    const next = resizeFreeFromCorner({
      corner: "br",
      startBox: sized,
      width: W,
      height: H,
      pointerCanvas: { x: 900, y: 900 },
    });
    expect(next.scale).toBe(sized.scale);
  });

  it("refuses to shrink either dimension below the minimum", () => {
    const next = resizeFreeFromCorner({
      corner: "br",
      startBox: sized,
      width: W,
      height: H,
      pointerCanvas: { x: sized.x + 1, y: sized.y + 1 },
    });
    expect(next.w).toBe(OVERLAY_MIN_EXTENT);
    expect(next.h).toBe(OVERLAY_MIN_EXTENT);
  });
});

describe("resize from an edge", () => {
  it("changes the width and leaves the height alone", () => {
    const next = resizeFromEdge({
      edge: "e",
      startBox: sized,
      width: W,
      height: H,
      pointerCanvas: { x: 100 + 700, y: 999 },
    });
    expect(next.w).toBe(700);
    expect(next.h).toBe(320);
  });

  it("changes the height and leaves the width alone", () => {
    const next = resizeFromEdge({
      edge: "s",
      startBox: sized,
      width: W,
      height: H,
      pointerCanvas: { x: 999, y: 200 + 50 },
    });
    expect(next.w).toBe(480);
    expect(next.h).toBe(OVERLAY_MIN_EXTENT);
  });

  it("anchors the opposite edge when dragging the west edge", () => {
    const next = resizeFromEdge({
      edge: "w",
      startBox: sized,
      width: W,
      height: H,
      pointerCanvas: { x: 300, y: 0 },
    });
    // The east edge was at 580 and must not move.
    expect(next.x + next.w!).toBeCloseTo(580);
    expect(next.y).toBe(sized.y);
  });

  it("anchors the opposite edge when dragging the north edge", () => {
    const next = resizeFromEdge({
      edge: "n",
      startBox: sized,
      width: W,
      height: H,
      pointerCanvas: { x: 0, y: 300 },
    });
    // The south edge was at 520 and must not move.
    expect(next.y + next.h!).toBeCloseTo(520);
    expect(next.x).toBe(sized.x);
  });
});

describe("the uniform resize every other overlay uses", () => {
  it("still preserves aspect ratio, because only the game resizes freely", () => {
    const next = resizeFromCorner({
      corner: "br",
      startBox: unsized,
      width: W,
      height: H,
      pointerCanvas: { x: 100 + 480, y: 200 + 320 },
    });
    expect(next.w).toBeUndefined();
    expect(next.h).toBeUndefined();
    expect(next.scale).toBeGreaterThan(0);
  });
});
