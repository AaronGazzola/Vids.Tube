"use client";

import { getFeaturedMessagesAction } from "@/app/(overlay)/overlay/[channelSlug]/page.actions";
import { useQuery } from "@tanstack/react-query";

export function useReadThisQueue(streamId: string | null) {
  return useQuery({
    queryKey: ["read-this", streamId],
    queryFn: () => getFeaturedMessagesAction(streamId!),
    enabled: !!streamId,
    refetchInterval: 8000,
  });
}
