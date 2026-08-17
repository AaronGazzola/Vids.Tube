import type { DemoBox } from "@/app/(app)/live/demo.types";

export type ResizeCorner = "tl" | "tr" | "bl" | "br";

export const OVERLAY_SCALE_MIN = 0.25;
export const OVERLAY_SCALE_MAX = 6;

type Point = { x: number; y: number };

// A box is drawn from its top-left at (x, y) and scaled about that same point,
// so the top-left is the only corner that never moves on its own.
export function cornerPoint(
  corner: ResizeCorner,
  box: DemoBox,
  width: number,
  height: number
): Point {
  const right = box.x + width * box.scale;
  const bottom = box.y + height * box.scale;
  switch (corner) {
    case "tl":
      return { x: box.x, y: box.y };
    case "tr":
      return { x: right, y: box.y };
    case "bl":
      return { x: box.x, y: bottom };
    case "br":
      return { x: right, y: bottom };
  }
}

export function oppositeCorner(corner: ResizeCorner): ResizeCorner {
  switch (corner) {
    case "tl":
      return "br";
    case "tr":
      return "bl";
    case "bl":
      return "tr";
    case "br":
      return "tl";
  }
}

export function anchorPoint(
  corner: ResizeCorner,
  box: DemoBox,
  width: number,
  height: number
): Point {
  return cornerPoint(oppositeCorner(corner), box, width, height);
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function clampScale(
  scale: number,
  min = OVERLAY_SCALE_MIN,
  max = OVERLAY_SCALE_MAX
): number {
  return Math.max(min, Math.min(max, scale));
}

// Bitmap content inside an overlay is requested at a size derived from the
// box's scale. Letting that scale fall mid-drag would re-request a smaller
// image the moment the pointer moved back, which reads as a flicker, so the
// scale that drives those requests only grows until the drag ends.
export function holdScaleWhileDragging(
  current: number,
  next: number,
  dragging: boolean
): number {
  return dragging ? Math.max(current, next) : next;
}

export type ResizeEdge = "n" | "s" | "e" | "w";

// Below this a box cannot be grabbed again, and for the game it is also a frame
// too small to see a creature in.
export const OVERLAY_MIN_EXTENT = 80;

// The size a freely-resized box currently occupies. A box that has not been
// resized yet carries no width or height, so it still means "the content's own
// size, scaled".
export function boxExtent(
  box: DemoBox,
  width: number,
  height: number
): { w: number; h: number } {
  return {
    w: box.w ?? width * box.scale,
    h: box.h ?? height * box.scale,
  };
}

// Free resize: the two axes move independently, so aspect ratio is NOT
// preserved. A separate function rather than a flag on the uniform one, because
// they are different operations — this one returns a width and a height and
// leaves `scale` alone, and every other overlay must keep resizing uniformly.
//
// The opposite corner is the anchor and does not move, so the box grows toward
// the pointer rather than away from it.
export function resizeFreeFromCorner(params: {
  corner: ResizeCorner;
  startBox: DemoBox;
  width: number;
  height: number;
  pointerCanvas: Point;
  min?: number;
}): DemoBox {
  const { corner, startBox, width, height, pointerCanvas } = params;
  const min = params.min ?? OVERLAY_MIN_EXTENT;
  const extent = boxExtent(startBox, width, height);
  const anchor = {
    x: corner === "tl" || corner === "bl" ? startBox.x + extent.w : startBox.x,
    y: corner === "tl" || corner === "tr" ? startBox.y + extent.h : startBox.y,
  };

  const w = Math.max(min, Math.abs(pointerCanvas.x - anchor.x));
  const h = Math.max(min, Math.abs(pointerCanvas.y - anchor.y));
  const movesLeft = corner === "tl" || corner === "bl";
  const movesUp = corner === "tl" || corner === "tr";

  return {
    ...startBox,
    w,
    h,
    x: movesLeft ? anchor.x - w : anchor.x,
    y: movesUp ? anchor.y - h : anchor.y,
  };
}

// One axis at a time, anchored at the opposite edge. This is what a corner
// cannot do: reach a shape by changing only its width or only its height.
export function resizeFromEdge(params: {
  edge: ResizeEdge;
  startBox: DemoBox;
  width: number;
  height: number;
  pointerCanvas: Point;
  min?: number;
}): DemoBox {
  const { edge, startBox, width, height, pointerCanvas } = params;
  const min = params.min ?? OVERLAY_MIN_EXTENT;
  const extent = boxExtent(startBox, width, height);

  if (edge === "e" || edge === "w") {
    const anchorX = edge === "w" ? startBox.x + extent.w : startBox.x;
    const w = Math.max(min, Math.abs(pointerCanvas.x - anchorX));
    return {
      ...startBox,
      w,
      h: extent.h,
      x: edge === "w" ? anchorX - w : startBox.x,
    };
  }

  const anchorY = edge === "n" ? startBox.y + extent.h : startBox.y;
  const h = Math.max(min, Math.abs(pointerCanvas.y - anchorY));
  return {
    ...startBox,
    w: extent.w,
    h,
    y: edge === "n" ? anchorY - h : startBox.y,
  };
}

// One scalar drives both dimensions, so aspect ratio cannot be violated. The
// dragged corner follows the pointer's distance from the anchor, and the box is
// then repositioned so the anchor itself stays exactly where it was.
export function resizeFromCorner(params: {
  corner: ResizeCorner;
  startBox: DemoBox;
  width: number;
  height: number;
  pointerCanvas: Point;
  min?: number;
  max?: number;
}): DemoBox {
  const { corner, startBox, width, height, pointerCanvas } = params;
  if (width <= 0 || height <= 0) return startBox;

  const anchor = anchorPoint(corner, startBox, width, height);
  const startCorner = cornerPoint(corner, startBox, width, height);
  const startDistance = distance(startCorner, anchor);
  if (startDistance === 0) return startBox;

  const scale = clampScale(
    (startBox.scale * distance(pointerCanvas, anchor)) / startDistance,
    params.min,
    params.max
  );

  const right = corner === "tl" || corner === "bl";
  const bottom = corner === "tl" || corner === "tr";

  return {
    scale,
    x: right ? anchor.x - width * scale : anchor.x,
    y: bottom ? anchor.y - height * scale : anchor.y,
  };
}
