"use client";

import { useQuery } from "@tanstack/react-query";
import { getGoalProgressAction } from "./page.actions";

export function useGoalProgress(
  channelSlug: string,
  intervalSec: number,
  enabled = true
) {
  return useQuery({
    queryKey: ["goal-progress", channelSlug],
    queryFn: () => getGoalProgressAction(channelSlug),
    refetchInterval: Math.max(3, intervalSec) * 1000,
    enabled,
  });
}
