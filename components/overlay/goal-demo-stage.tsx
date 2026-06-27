"use client";

import type { GoalMetric, MetricProgress } from "@/app/layout.types";
import { useState } from "react";
import { GoalBar } from "./goal-bar";

const GRADIENT =
  "linear-gradient(135deg, #ff6b6b 0%, #f9d423 25%, #1dd1a1 50%, #54a0ff 75%, #5f27cd 100%)";

type Box = { x: number; y: number; scale: number };

function defaultBoxes(bars: GoalMetric[]): Record<string, Box> {
  return Object.fromEntries(
    bars.map((m, i) => [m, { x: 40 + i * 150, y: 90, scale: 1 }])
  );
}

export function GoalDemoStage({
  bars,
  metrics,
  height,
}: {
  bars: GoalMetric[];
  metrics: Record<GoalMetric, MetricProgress>;
  height: number;
}) {
  const [boxes, setBoxes] = useState<Record<string, Box>>(() =>
    defaultBoxes(bars)
  );
  const [gradient, setGradient] = useState(true);
  const [full, setFull] = useState(false);

  const shown = full
    ? (Object.fromEntries(
        bars.map((m) => [
          m,
          {
            ...metrics[m],
            current: metrics[m].target,
            total: metrics[m].goal,
            pct: 100,
            reached: true,
          },
        ])
      ) as Record<GoalMetric, MetricProgress>)
    : metrics;

  function startDrag(m: GoalMetric, e: React.PointerEvent) {
    e.preventDefault();
    const s = { px: e.clientX, py: e.clientY, x: boxes[m].x, y: boxes[m].y };
    const move = (ev: PointerEvent) =>
      setBoxes((b) => ({
        ...b,
        [m]: {
          ...b[m],
          x: s.x + (ev.clientX - s.px),
          y: s.y + (ev.clientY - s.py),
        },
      }));
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  function startResize(m: GoalMetric, e: React.PointerEvent) {
    e.preventDefault();
    e.stopPropagation();
    const s = { py: e.clientY, scale: boxes[m].scale };
    const move = (ev: PointerEvent) => {
      const scale = Math.max(
        0.4,
        Math.min(3, s.scale + (ev.clientY - s.py) / 220)
      );
      setBoxes((b) => ({ ...b, [m]: { ...b[m], scale } }));
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      <div className="fixed inset-0 -z-20 bg-black" />
      {gradient && (
        <div className="fixed inset-0 -z-10" style={{ background: GRADIENT }} />
      )}

      <div className="fixed right-3 top-3 z-20 flex flex-col items-stretch gap-2 text-sm">
        <button
          onClick={() => setGradient((v) => !v)}
          className="rounded-lg bg-black/70 px-3 py-1.5 font-medium text-white backdrop-blur-sm hover:bg-black/90"
        >
          Background: {gradient ? "Gradient" : "Off"}
        </button>
        <button
          onClick={() => setBoxes(defaultBoxes(bars))}
          className="rounded-lg bg-black/70 px-3 py-1.5 font-medium text-white backdrop-blur-sm hover:bg-black/90"
        >
          Reset layout
        </button>
        <button
          onClick={() => setFull((v) => !v)}
          className="rounded-lg bg-black/70 px-3 py-1.5 font-medium text-white backdrop-blur-sm hover:bg-black/90"
        >
          Show: {full ? "Full" : "In progress"}
        </button>
      </div>

      {bars.map((m) => (
        <div
          key={m}
          onPointerDown={(e) => startDrag(m, e)}
          className="absolute cursor-move touch-none select-none"
          style={{
            left: boxes[m].x,
            top: boxes[m].y,
            transform: `scale(${boxes[m].scale})`,
            transformOrigin: "top left",
          }}
        >
          <GoalBar metric={m} data={shown[m]} height={height} />
          <div
            onPointerDown={(e) => startResize(m, e)}
            className="absolute -bottom-1.5 -right-1.5 h-4 w-4 cursor-nwse-resize rounded-full border border-white bg-black/70"
          />
        </div>
      ))}
    </div>
  );
}
