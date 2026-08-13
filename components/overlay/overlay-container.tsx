"use client";

import type { DemoBox, DemoBoxKey } from "@/app/(app)/live/demo.types";
import { OverlayScaleProvider } from "@/components/overlay/overlay-scale-context";
import {
  holdScaleWhileDragging,
  resizeFromCorner,
  type ResizeCorner,
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

  function startResize(e: React.PointerEvent, corner: ResizeCorner) {
    e.preventDefault();
    e.stopPropagation();
    if (pxScale <= 0) return;
    const { width, height } = measure();
    if (width <= 0 || height <= 0) return;

    const startBox = { ...box };
    const startPointer = { px: e.clientX, py: e.clientY };
    const startCorner = {
      x:
        corner === "tr" || corner === "br"
          ? startBox.x + width * startBox.scale
          : startBox.x,
      y:
        corner === "bl" || corner === "br"
          ? startBox.y + height * startBox.scale
          : startBox.y,
    };

    setHeldScale(startBox.scale);

    const move = (ev: PointerEvent) => {
      const pointerCanvas = {
        x: startCorner.x + (ev.clientX - startPointer.px) / pxScale,
        y: startCorner.y + (ev.clientY - startPointer.py) / pxScale,
      };
      const next = resizeFromCorner({
        corner,
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

  const handleScale = pxScale > 0 ? 1 / (pxScale * box.scale) : 1;

  return (
    <div
      ref={contentRef}
      data-testid={`overlay-container-${boxKey}`}
      onPointerDown={startDrag}
      className="relative cursor-move touch-none select-none"
      // An overlay rendering nothing has no size, so its container would
      // collapse and could not be grabbed. The minimum applies only while
      // positioning, and only bites when the content is smaller than it.
      style={{ minWidth: MIN_BOX, minHeight: MIN_BOX }}
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
          onPointerDown={(e) => startResize(e, corner)}
          className={cn(
            "absolute h-4 w-4 rounded-full border-2 border-sky-300 bg-white",
            className,
            cursor
          )}
          style={{ transform: `scale(${handleScale})` }}
        />
      ))}
    </div>
  );
}
