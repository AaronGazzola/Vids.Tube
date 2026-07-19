"use client";

import { useQuery } from "@tanstack/react-query";
import { getBreakStateAction } from "./page.actions";

export function useBreakState(channelSlug: string) {
  return useQuery({
    queryKey: ["break-state", channelSlug],
    queryFn: () => getBreakStateAction(channelSlug),
    refetchInterval: 5000,
  });
}
