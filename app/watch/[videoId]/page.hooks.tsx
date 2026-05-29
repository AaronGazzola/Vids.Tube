"use client";

import { useQuery } from "@tanstack/react-query";
import { getVideoAction } from "./page.actions";

export function useVideo(videoId: string) {
  return useQuery({
    queryKey: ["video", videoId],
    queryFn: () => getVideoAction(videoId),
  });
}
