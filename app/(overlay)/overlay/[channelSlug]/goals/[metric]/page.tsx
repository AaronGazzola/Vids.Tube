"use client";

import type { GoalMetric, MetricProgress } from "@/app/layout.types";
import { GOAL_METRICS } from "@/app/layout.types";
import { OverlayBoxFrame } from "@/components/overlay/box-frame";
import { GoalBar } from "@/components/overlay/goal-bar";
import { DEFAULT_GOALS, idleProgress } from "@/lib/goals";
import { GOAL_METRIC_BOX, OVERLAY_GOAL_HEIGHT } from "@/lib/demo-overlay";
import { notFound, useSearchParams } from "next/navigation";
import { use } from "react";
import { useDemoOverlaySnapshot, useOverlayLayout } from "../../page.hooks";
import { useGoalProgress } from "../page.hooks";

const DEMO_METRICS: Record<GoalMetric, MetricProgress> = {
  subs: { current: 34, target: 50, total: 984, goal: 1000, pct: 68, reached: false },
  likes: { current: 410, target: 500, total: 410, goal: 500, pct: 82, reached: false },
  viewers: { current: 78, target: 100, total: 78, goal: 100, pct: 78, reached: false },
};

export default function GoalMetricOverlayPage({
  params,
}: {
  params: Promise<{ channelSlug: string; metric: string }>;
}) {
  const { channelSlug, metric } = use(params);
  const sp = useSearchParams();

  const interval = Math.max(3, Number(sp.get("interval")) || 10);
  const height = Number(sp.get("height")) || 320;
  const demo = sp.get("demo") === "1";

  const snapshot = useDemoOverlaySnapshot(channelSlug);
  const { data: layout } = useOverlayLayout(channelSlug);
  const { data } = useGoalProgress(channelSlug, interval, !demo);

  if (!(GOAL_METRICS as string[]).includes(metric)) {
    notFound();
  }
  const m = metric as GoalMetric;

  if (snapshot) {
    if (!snapshot.visible[GOAL_METRIC_BOX[m]]) {
      return null;
    }
    return (
      <OverlayBoxFrame scale={snapshot.boxes[GOAL_METRIC_BOX[m]].scale}>
        <GoalBar
          metric={m}
          data={snapshot.metrics[m]}
          height={OVERLAY_GOAL_HEIGHT}
        />
      </OverlayBoxFrame>
    );
  }

  if (demo) {
    return (
      <div className="flex items-start p-6">
        <GoalBar metric={m} data={DEMO_METRICS[m]} height={height} />
      </div>
    );
  }

  if (!data?.active || !data.metrics) {
    if (data && !data.isLive) {
      return (
        <OverlayBoxFrame scale={layout?.boxes[GOAL_METRIC_BOX[m]].scale ?? 1}>
          <GoalBar
            metric={m}
            data={idleProgress(DEFAULT_GOALS[m])}
            height={OVERLAY_GOAL_HEIGHT}
          />
        </OverlayBoxFrame>
      );
    }
    return null;
  }

  if (layout) {
    return (
      <OverlayBoxFrame scale={layout.boxes[GOAL_METRIC_BOX[m]].scale}>
        <GoalBar metric={m} data={data.metrics[m]} height={OVERLAY_GOAL_HEIGHT} />
      </OverlayBoxFrame>
    );
  }

  return (
    <div className="flex items-start p-6">
      <GoalBar metric={m} data={data.metrics[m]} height={height} />
    </div>
  );
}
