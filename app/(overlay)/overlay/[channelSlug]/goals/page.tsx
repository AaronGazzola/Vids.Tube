"use client";

import type { GoalMetric, MetricProgress } from "@/app/layout.types";
import { GOAL_METRICS } from "@/app/layout.types";
import { GoalBar } from "@/components/overlay/goal-bar";
import { GoalDemoStage } from "@/components/overlay/goal-demo-stage";
import { useSearchParams } from "next/navigation";
import { use } from "react";
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

  const { data } = useGoalProgress(channelSlug, interval, !demo);

  if (demo) {
    return <GoalDemoStage bars={bars} metrics={DEMO_METRICS} height={height} />;
  }

  if (!data?.active || !data.metrics) {
    return null;
  }
  const metrics = data.metrics;

  return (
    <div className="flex items-start gap-8 p-6">
      {bars.map((m) => (
        <GoalBar key={m} metric={m} data={metrics[m]} height={height} />
      ))}
    </div>
  );
}
