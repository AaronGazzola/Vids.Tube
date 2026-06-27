"use client";

import type { ReactNode } from "react";

export type Box = { x: number; y: number; scale: number };

export function DraggableResizable({
  box,
  onChange,
  children,
}: {
  box: Box;
  onChange: (b: Box) => void;
  children: ReactNode;
}) {
  function startDrag(e: React.PointerEvent) {
    e.preventDefault();
    const s = { px: e.clientX, py: e.clientY, x: box.x, y: box.y };
    const move = (ev: PointerEvent) =>
      onChange({
        ...box,
        x: s.x + (ev.clientX - s.px),
        y: s.y + (ev.clientY - s.py),
      });
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  function startResize(e: React.PointerEvent) {
    e.preventDefault();
    e.stopPropagation();
    const s = { py: e.clientY, scale: box.scale };
    const move = (ev: PointerEvent) => {
      const scale = Math.max(0.4, Math.min(3, s.scale + (ev.clientY - s.py) / 220));
      onChange({ ...box, scale });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  return (
    <div
      onPointerDown={startDrag}
      className="absolute cursor-move touch-none select-none"
      style={{
        left: box.x,
        top: box.y,
        transform: `scale(${box.scale})`,
        transformOrigin: "top left",
      }}
    >
      {children}
      <div
        onPointerDown={startResize}
        className="absolute -bottom-2 -right-2 h-4 w-4 cursor-nwse-resize rounded-full border border-white bg-black/70"
      />
    </div>
  );
}
