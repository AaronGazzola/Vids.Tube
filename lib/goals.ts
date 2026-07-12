import type { GoalMetric, MetricProgress } from "@/app/layout.types";

export type Counts = { subs: number; likes: number; viewers: number };

export const DEFAULT_GOALS: Counts = { subs: 1000, likes: 500, viewers: 100 };

function fromBaseline(
  now: number,
  baseline: number,
  goal: number
): MetricProgress {
  const current = Math.max(0, now - baseline);
  const target = Math.max(0, goal - baseline);
  const pct =
    target > 0 ? Math.min(100, (current / target) * 100) : now >= goal ? 100 : 0;
  return { current, target, total: now, goal, pct, reached: pct >= 100 };
}

function fromAbsolute(now: number, goal: number): MetricProgress {
  const pct = goal > 0 ? Math.min(100, (now / goal) * 100) : 0;
  return { current: now, target: goal, total: now, goal, pct, reached: pct >= 100 };
}

export function computeGoalProgress(
  counts: Counts,
  baseline: Counts | null,
  goals: Counts
): Record<GoalMetric, MetricProgress> {
  const b = baseline ?? { subs: 0, likes: 0, viewers: 0 };
  return {
    // Subs are a delta from an auto-captured baseline; likes and viewers are
    // absolute current YouTube values (no baseline, no start).
    subs: fromBaseline(counts.subs, b.subs, goals.subs),
    likes: fromAbsolute(counts.likes, goals.likes),
    viewers: fromAbsolute(counts.viewers, goals.viewers),
  };
}
