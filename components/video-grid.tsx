"use client";

import { VideoCard } from "@/components/video-card";
import { Skeleton } from "@/components/ui/skeleton";
import { useChannelVideos } from "@/app/[channelSlug]/page.hooks";

export function VideoGrid({ channelId }: { channelId: string }) {
  const { data: videos, isPending } = useChannelVideos(channelId);

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

  if (!videos || videos.length === 0) {
    return <p className="text-sm text-muted-foreground">No videos yet.</p>;
  }

  return (
    <div className="grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {videos.map((video) => (
        <VideoCard key={video.id} video={video} />
      ))}
    </div>
  );
}
