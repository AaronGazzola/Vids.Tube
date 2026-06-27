"use client";

import { useQuery } from "@tanstack/react-query";
import { getCompetitionAction } from "./page.actions";

export function useCompetition(channelSlug: string, intervalSec: number) {
  return useQuery({
    queryKey: ["competition", channelSlug],
    queryFn: () => getCompetitionAction(channelSlug),
    refetchInterval: Math.max(3, intervalSec) * 1000,
  });
}
