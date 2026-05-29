"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { useParams } from "next/navigation";
import { useVideo } from "./page.hooks";

const VOD_BASE_URL = process.env.NEXT_PUBLIC_VOD_BASE_URL ?? "";

export default function WatchPage() {
  const params = useParams<{ videoId: string }>();
  const { data: video, isPending } = useVideo(params.videoId);

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 p-4 md:p-6">
      {isPending ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="aspect-video w-full rounded-lg" />
          <Skeleton className="h-7 w-2/3" />
        </div>
      ) : video?.mp4_path ? (
        <div className="flex flex-col gap-4">
          <video
            className="aspect-video w-full rounded-lg bg-black"
            controls
            playsInline
            poster={
              video.thumbnail_path
                ? `${VOD_BASE_URL}/${video.thumbnail_path}`
                : undefined
            }
            src={`${VOD_BASE_URL}/${video.mp4_path}`}
          />
          <h1 className="text-2xl font-bold">{video.title ?? "Untitled"}</h1>
        </div>
      ) : (
        <div className="py-16 text-center">
          <h1 className="text-2xl font-bold">Video not available</h1>
          <p className="mt-2 text-muted-foreground">
            This video may still be processing or no longer exists.
          </p>
        </div>
      )}
    </main>
  );
}
