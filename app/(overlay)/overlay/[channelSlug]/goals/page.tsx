"use client";

import type { GoalMetric, MetricProgress } from "@/app/layout.types";
import { GOAL_METRICS } from "@/app/layout.types";
import { OverlayBoxFrame } from "@/components/overlay/box-frame";
import { GoalBar } from "@/components/overlay/goal-bar";
import { GoalDemoStage } from "@/components/overlay/goal-demo-stage";
import { DEFAULT_GOALS, idleProgress } from "@/lib/goals";
import {
  GOAL_METRIC_BOX,
  OVERLAY_BASE_DIMS,
  OVERLAY_GOAL_HEIGHT,
} from "@/lib/demo-overlay";
import { useSearchParams } from "next/navigation";
import { use } from "react";
import { useDemoOverlaySnapshot, useOverlayLayout } from "../page.hooks";
import { useGoalProgress } from "./page.hooks";

const DEMO_METRICS: Record<GoalMetric, MetricProgress> = {
  subs: { current: 34, target: 50, total: 984, goal: 1000, pct: 68, reached: false },
  likes: { current: 410, target: 500, total: 410, goal: 500, pct: 82, reached: false },
  viewers: { current: 78, target: 100, total: 78, goal: 100, pct: 78, reached: false },
};

export default function GoalsOverlayPage({
  params,
}: {
  params: Promise<{ channelSlug: string }>;
}) {
  const { channelSlug } = use(params);
  const sp = useSearchParams();

  const requested = (sp.get("bars")?.split(",") ?? []).filter((b): b is GoalMetric =>
    (GOAL_METRICS as string[]).includes(b)
  );
  const bars = requested.length ? requested : GOAL_METRICS;
  const interval = Math.max(3, Number(sp.get("interval")) || 10);
  const height = Number(sp.get("height")) || 320;
  const demo = sp.get("demo") === "1";

  const snapshot = useDemoOverlaySnapshot(channelSlug);
  const { data: layout } = useOverlayLayout(channelSlug);
  const { data } = useGoalProgress(channelSlug, interval, !demo);

  if (snapshot) {
    const shown = bars.filter((m) => snapshot.visible[GOAL_METRIC_BOX[m]]);
    if (shown.length === 0) {
      return null;
    }
    return (
      <div className="flex items-start">
        {shown.map((m) => {
          const scale = snapshot.boxes[GOAL_METRIC_BOX[m]].scale;
          return (
            <div
              key={m}
              style={{
                width: OVERLAY_BASE_DIMS.goal.w * scale,
                height: OVERLAY_BASE_DIMS.goal.h * scale,
              }}
            >
              <OverlayBoxFrame scale={scale}>
                <GoalBar
                  metric={m}
                  data={snapshot.metrics[m]}
                  height={OVERLAY_GOAL_HEIGHT}
                />
              </OverlayBoxFrame>
            </div>
          );
        })}
      </div>
    );
  }

  if (demo) {
    return <GoalDemoStage bars={bars} metrics={DEMO_METRICS} height={height} />;
  }

  if (!data?.active || !data.metrics) {
    if (data && !data.isLive) {
      return (
        <div className="flex items-start">
          {bars.map((m) => {
            const scale = layout?.boxes[GOAL_METRIC_BOX[m]].scale ?? 1;
            return (
              <div
                key={m}
                style={{
                  width: OVERLAY_BASE_DIMS.goal.w * scale,
                  height: OVERLAY_BASE_DIMS.goal.h * scale,
                }}
              >
                <OverlayBoxFrame scale={scale}>
                  <GoalBar
                    metric={m}
                    data={idleProgress(DEFAULT_GOALS[m])}
                    height={OVERLAY_GOAL_HEIGHT}
                  />
                </OverlayBoxFrame>
              </div>
            );
          })}
        </div>
      );
    }
    return null;
  }
  const metrics = data.metrics;

  if (layout) {
    return (
      <div className="flex items-start">
        {bars.map((m) => {
          const scale = layout.boxes[GOAL_METRIC_BOX[m]].scale;
          return (
            <div
              key={m}
              style={{
                width: OVERLAY_BASE_DIMS.goal.w * scale,
                height: OVERLAY_BASE_DIMS.goal.h * scale,
              }}
            >
              <OverlayBoxFrame scale={scale}>
                <GoalBar
                  metric={m}
                  data={metrics[m]}
                  height={OVERLAY_GOAL_HEIGHT}
                />
              </OverlayBoxFrame>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex items-start gap-8 p-6">
      {bars.map((m) => (
        <GoalBar key={m} metric={m} data={metrics[m]} height={height} />
      ))}
    </div>
  );
}
