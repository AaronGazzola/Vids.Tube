"use client";

import type { DemoBox, DemoBoxKey } from "@/app/(app)/live/demo.types";
import { OverlayScaleProvider } from "@/components/overlay/overlay-scale-context";
import {
  boxExtent,
  holdScaleWhileDragging,
  resizeFreeFromCorner,
  resizeFromCorner,
  resizeFromEdge,
  type ResizeCorner,
  type ResizeEdge,
} from "@/lib/overlay-resize";
import { cn } from "@/lib/utils";
import { useRef, useState, type ReactNode } from "react";

const MIN_BOX = 96;

const CORNERS: { corner: ResizeCorner; className: string; cursor: string }[] = [
  { corner: "tl", className: "-left-2 -top-2", cursor: "cursor-nwse-resize" },
  { corner: "tr", className: "-right-2 -top-2", cursor: "cursor-nesw-resize" },
  { corner: "bl", className: "-bottom-2 -left-2", cursor: "cursor-nesw-resize" },
  { corner: "br", className: "-bottom-2 -right-2", cursor: "cursor-nwse-resize" },
];

// Only a freely-resized box gets these. A corner alone cannot reach a shape by
// changing one axis, which is the whole point of a box that is not a card.
const EDGES: { edge: ResizeEdge; className: string; cursor: string }[] = [
  { edge: "n", className: "-top-2 left-1/2 -translate-x-1/2", cursor: "cursor-ns-resize" },
  { edge: "s", className: "-bottom-2 left-1/2 -translate-x-1/2", cursor: "cursor-ns-resize" },
  { edge: "w", className: "-left-2 top-1/2 -translate-y-1/2", cursor: "cursor-ew-resize" },
  { edge: "e", className: "-right-2 top-1/2 -translate-y-1/2", cursor: "cursor-ew-resize" },
];

export function OverlayContainer({
  boxKey,
  box,
  setBox,
  pxScale,
  active,
  label,
  children,
}: {
  boxKey: DemoBoxKey;
  box: DemoBox;
  setBox: (key: DemoBoxKey, box: DemoBox) => void;
  pxScale: number;
  active: boolean;
  label: string;
  children: ReactNode;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [heldScale, setHeldScale] = useState<number | null>(null);

  if (!active) {
    return <>{children}</>;
  }

  const measure = () => ({
    width: contentRef.current?.offsetWidth ?? 0,
    height: contentRef.current?.offsetHeight ?? 0,
  });

  function startDrag(e: React.PointerEvent) {
    e.preventDefault();
    if (pxScale <= 0) return;
    const start = { px: e.clientX, py: e.clientY, x: box.x, y: box.y };
    const move = (ev: PointerEvent) =>
      setBox(boxKey, {
        ...box,
        x: start.x + (ev.clientX - start.px) / pxScale,
        y: start.y + (ev.clientY - start.py) / pxScale,
      });
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  // A box carrying its own width and height resizes freely; every other box is
  // scaled uniformly about its top-left, exactly as before.
  const free = box.w !== undefined && box.h !== undefined;

  function startResize(
    e: React.PointerEvent,
    grip: { corner: ResizeCorner } | { edge: ResizeEdge }
  ) {
    e.preventDefault();
    e.stopPropagation();
    if (pxScale <= 0) return;
    const { width, height } = measure();
    if (width <= 0 || height <= 0) return;

    const startBox = { ...box };
    const startPointer = { px: e.clientX, py: e.clientY };
    const extent = boxExtent(startBox, width, height);
    const corner = "corner" in grip ? grip.corner : null;
    const edge = "edge" in grip ? grip.edge : null;

    // Where the grip sits right now, so the pointer's movement can be added to
    // it rather than the box jumping to the pointer on the first frame.
    const startGrip = {
      x:
        corner === "tr" || corner === "br" || edge === "e"
          ? startBox.x + extent.w
          : edge === "n" || edge === "s"
            ? startBox.x + extent.w / 2
            : startBox.x,
      y:
        corner === "bl" || corner === "br" || edge === "s"
          ? startBox.y + extent.h
          : edge === "e" || edge === "w"
            ? startBox.y + extent.h / 2
            : startBox.y,
    };

    setHeldScale(startBox.scale);

    const move = (ev: PointerEvent) => {
      const pointerCanvas = {
        x: startGrip.x + (ev.clientX - startPointer.px) / pxScale,
        y: startGrip.y + (ev.clientY - startPointer.py) / pxScale,
      };
      const next = edge
        ? resizeFromEdge({ edge, startBox, width, height, pointerCanvas })
        : free
          ? resizeFreeFromCorner({
              corner: corner!,
              startBox,
              width,
              height,
              pointerCanvas,
            })
          : resizeFromCorner({
              corner: corner!,
              startBox,
              width,
              height,
              pointerCanvas,
            });
      setBox(boxKey, next);
      setHeldScale((held) =>
        holdScaleWhileDragging(held ?? next.scale, next.scale, true)
      );
    };
    const up = () => {
      setHeldScale(null);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  // A freely-resized box is given its size outright, so the frame inside is
  // genuinely resized rather than stretched, and its handles are already in
  // canvas units and need no counter-scaling.
  const handleScale = free
    ? pxScale > 0
      ? 1 / pxScale
      : 1
    : pxScale > 0
      ? 1 / (pxScale * box.scale)
      : 1;

  return (
    <div
      ref={contentRef}
      data-testid={`overlay-container-${boxKey}`}
      onPointerDown={startDrag}
      className="relative cursor-move touch-none select-none"
      // An overlay rendering nothing has no size, so its container would
      // collapse and could not be grabbed. The minimum applies only while
      // positioning, and only bites when the content is smaller than it.
      style={
        free
          ? { width: box.w, height: box.h }
          : { minWidth: MIN_BOX, minHeight: MIN_BOX }
      }
    >
      <OverlayScaleProvider
        scale={holdScaleWhileDragging(
          heldScale ?? box.scale,
          box.scale,
          heldScale !== null
        )}
      >
        {children}
      </OverlayScaleProvider>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 border-dashed border-sky-300"
        style={{ borderWidth: 2 * handleScale }}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute left-0 top-0 whitespace-nowrap rounded-br bg-sky-300 px-1 font-medium text-sky-950"
        style={{
          fontSize: 11 * handleScale,
          lineHeight: 1.4,
          padding: `${1 * handleScale}px ${3 * handleScale}px`,
        }}
      >
        {label}
      </span>
      {CORNERS.map(({ corner, className, cursor }) => (
        <div
          key={corner}
          role="button"
          aria-label={`Resize ${label} from its ${corner} corner`}
          data-testid={`overlay-handle-${boxKey}-${corner}`}
          onPointerDown={(e) => startResize(e, { corner })}
          className={cn(
            "absolute h-4 w-4 rounded-full border-2 border-sky-300 bg-white",
            className,
            cursor
          )}
          style={{ transform: `scale(${handleScale})` }}
        />
      ))}
      {free &&
        EDGES.map(({ edge, className, cursor }) => (
          <div
            key={edge}
            role="button"
            aria-label={`Resize ${label} from its ${edge} edge`}
            data-testid={`overlay-handle-${boxKey}-${edge}`}
            onPointerDown={(e) => startResize(e, { edge })}
            className={cn(
              "absolute h-4 w-4 rounded-sm border-2 border-sky-300 bg-white",
              className,
              cursor
            )}
          />
        ))}
    </div>
  );
}
