"use client";

import { useQuery } from "@tanstack/react-query";
import {
  getChannelBySlugAction,
  getChannelVideosAction,
} from "./page.actions";

export function useChannel(slug: string) {
  return useQuery({
    queryKey: ["channel", slug],
    queryFn: () => getChannelBySlugAction(slug),
  });
}

export function useChannelVideos(channelId: string | undefined) {
  return useQuery({
    queryKey: ["channel-videos", channelId],
    queryFn: () => getChannelVideosAction(channelId!),
    enabled: !!channelId,
  });
}
