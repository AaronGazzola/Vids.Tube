"use client";

import type { GoalMetric } from "@/app/layout.types";
import { GoalIcon } from "@/components/overlay/goal-bar";
import { OVERLAY_GOAL_FLIGHT_MS } from "@/lib/demo-overlay";

// What the number under the icon says. Subs and likes announce the increment,
// because one more person subscribing is the event worth marking. Viewers
// announce the total, because a viewer count is a level rather than a tally and
// "+1" would say nothing about how many are watching.
export function riseBadge(metric: GoalMetric, delta: number, total: number): string {
  if (metric === "viewers") return total.toLocaleString("en-US");
  return `+${delta.toLocaleString("en-US")}`;
}

// Announces a rise across the middle of the broadcast, then flies to the goal
// overlay it belongs to and shrinks away as it arrives.
//
// The travel is handed in as a delta rather than worked out here: only the stage
// knows where the streamer put the goal box and what they scaled it to, and
// asking the DOM would mean measuring a canvas that is itself being scaled to
// fit whatever is displaying it.
export function GoalRiseFlyer({
  metric,
  message,
  badge,
  cx,
  cy,
  dx,
  dy,
  size = 120,
  onDone,
}: {
  metric: GoalMetric;
  message: string;
  badge: string;
  cx: number;
  cy: number;
  dx: number;
  dy: number;
  size?: number;
  onDone: () => void;
}) {
  return (
    <div
      aria-hidden
      data-testid={`goal-rise-flyer-${metric}`}
      className="pointer-events-none absolute flex flex-col items-center gap-3 text-white"
      style={
        {
          // Sits at the canvas origin and is moved entirely by transform, so the
          // whole flight composites. The centring shift is inside the keyframes
          // rather than here, so the zoom grows out of the middle of the
          // broadcast rather than down and to the right of it.
          left: 0,
          top: 0,
          transformOrigin: "center center",
          "--rise-cx": `${cx}px`,
          "--rise-cy": `${cy}px`,
          "--rise-dx": `${dx}px`,
          "--rise-dy": `${dy}px`,
          animation: `overlay-goal-flight ${OVERLAY_GOAL_FLIGHT_MS}ms ease-in-out forwards`,
        } as React.CSSProperties
      }
      onAnimationEnd={onDone}
    >
      {message.trim() && (
        <span
          className="overlay-surface whitespace-nowrap rounded-2xl border border-white px-6 py-3 text-[40px] font-bold leading-none shadow-lg"
          style={{ "--overlay-surface-alpha": 1 } as React.CSSProperties}
        >
          {message}
        </span>
      )}
      <GoalIcon metric={metric} size={size} />
      <span
        className="font-bold tabular-nums leading-none drop-shadow"
        style={{ fontSize: size * 0.55 }}
      >
        {badge}
      </span>
    </div>
  );
}
