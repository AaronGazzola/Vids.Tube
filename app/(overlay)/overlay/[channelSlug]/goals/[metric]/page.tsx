"use client";

import type { GoalMetric, MetricProgress } from "@/app/layout.types";
import { GOAL_METRICS } from "@/app/layout.types";
import { GoalBar } from "@/components/overlay/goal-bar";
import { notFound, useSearchParams } from "next/navigation";
import { use } from "react";
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

  const { data } = useGoalProgress(channelSlug, interval, !demo);

  if (!(GOAL_METRICS as string[]).includes(metric)) {
    notFound();
  }
  const m = metric as GoalMetric;

  if (demo) {
    return (
      <div className="flex items-start p-6">
        <GoalBar metric={m} data={DEMO_METRICS[m]} height={height} />
      </div>
    );
  }

  if (!data?.active || !data.metrics) {
    return null;
  }

  return (
    <div className="flex items-start p-6">
      <GoalBar metric={m} data={data.metrics[m]} height={height} />
    </div>
  );
}
