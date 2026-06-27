"use client";

import { useQuery } from "@tanstack/react-query";
import { getOwnerVideosAction } from "./page.actions";

export function useOwnerVideos() {
  return useQuery({
    queryKey: ["owner-videos"],
    queryFn: () => getOwnerVideosAction(),
  });
}
