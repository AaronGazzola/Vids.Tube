"use client";

import { getStreamTimelineAction } from "@/app/(app)/studio/timeline/[streamId]/page.actions";
import type { TimelineStreamDetail } from "@/app/(app)/studio/timeline/[streamId]/page.types";
import { useQuery } from "@tanstack/react-query";

export function useStreamTimeline(streamId: string) {
  return useQuery<TimelineStreamDetail>({
    queryKey: ["studio", "timeline", streamId],
    queryFn: async () => {
      const res = await getStreamTimelineAction(streamId);
      if ("error" in res) {
        throw new Error(res.error);
      }
      return res.data;
    },
    enabled: !!streamId,
  });
}
