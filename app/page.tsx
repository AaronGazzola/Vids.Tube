"use client";

import { LiveBanner } from "@/components/live-banner";
import { Skeleton } from "@/components/ui/skeleton";
import type { VideoCardData } from "@/components/video-card";
import { VideoGrid } from "@/components/video-grid";
import { useOwnerChannel } from "./page.hooks";

const placeholderVideos: VideoCardData[] = Array.from(
  { length: 6 },
  (_, index) => ({
    id: `placeholder-${index + 1}`,
    title: `Sample VOD ${index + 1}`,
    meta: "Placeholder · 0 views",
  })
);

export default function HomePage() {
  const { data: channel, isPending } = useOwnerChannel();

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 p-4 md:p-6">
      <section className="mb-6">
        {isPending ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-8 w-56" />
            <Skeleton className="h-4 w-80" />
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-bold">{channel?.name ?? "vids.tube"}</h1>
            {channel?.description && (
              <p className="mt-1 text-muted-foreground">{channel.description}</p>
            )}
          </>
        )}
      </section>

      <section className="mb-8">
        <LiveBanner isLive={false} />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Videos</h2>
        <VideoGrid videos={placeholderVideos} />
      </section>
    </main>
  );
}
