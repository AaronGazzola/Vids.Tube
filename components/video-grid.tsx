"use client";

import {
  useChannelProcessingVideos,
  useChannelVideos,
} from "@/app/[channelSlug]/page.hooks";
import { useIsChannelOwner } from "@/app/layout.hooks";
import { ProcessingVideoCard } from "@/components/processing-video-card";
import { Skeleton } from "@/components/ui/skeleton";
import { VideoCard } from "@/components/video-card";
import type { Database } from "@/supabase/types";

type Channel = Database["public"]["Tables"]["channels"]["Row"];

export function VideoGrid({ channel }: { channel: Channel }) {
  const isOwner = useIsChannelOwner(channel);
  const { data: videos, isPending } = useChannelVideos(channel.id);
  const { data: processing } = useChannelProcessingVideos(channel.id, isOwner);

  if (isPending) {
    return (
      <div className="grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-3">
            <Skeleton className="aspect-video w-full rounded-xl" />
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-1/3" />
          </div>
        ))}
      </div>
    );
  }

  const processingCount = processing?.length ?? 0;
  const readyCount = videos?.length ?? 0;

  if (processingCount === 0 && readyCount === 0) {
    return <p className="text-sm text-muted-foreground">No videos yet.</p>;
  }

  return (
    <div className="grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {processing?.map((video) => (
        <ProcessingVideoCard key={video.id} video={video} />
      ))}
      {videos?.map((video) => (
        <VideoCard key={video.id} video={video} />
      ))}
    </div>
  );
}
