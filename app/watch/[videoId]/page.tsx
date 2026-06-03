"use client";

import { ChatReplay } from "@/components/chat-replay";
import { CommentsSection } from "@/components/comments/comments-section";
import { Skeleton } from "@/components/ui/skeleton";
import { VideoPlayer } from "@/components/video-player";
import { cn } from "@/lib/utils";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useChatReplay, useVideo } from "./page.hooks";

const VOD_BASE_URL = process.env.NEXT_PUBLIC_VOD_BASE_URL ?? "";

function vodUrl(path: string | null): string | undefined {
  if (!path) {
    return undefined;
  }
  return `${VOD_BASE_URL}/${path}`;
}

export default function WatchPage() {
  const params = useParams<{ videoId: string }>();
  const { data: video, isPending } = useVideo(params.videoId);
  const { data: replayMessages = [] } = useChatReplay(
    video?.source_stream_id ?? null
  );
  const [currentTimeMs, setCurrentTimeMs] = useState(0);
  const [replayDismissed, setReplayDismissed] = useState(false);

  const showReplay = replayMessages.length > 0 && !replayDismissed;

  const isVertical =
    !!video?.width &&
    !!video?.height &&
    video.height > video.width;

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 p-4 md:p-6">
      {isPending ? (
        <div className="flex flex-col gap-4">
          <Skeleton
            className={
              isVertical
                ? "mx-auto aspect-[9/16] w-full max-w-[420px] rounded-lg"
                : "aspect-video w-full rounded-lg"
            }
          />
          <Skeleton className="h-7 w-2/3" />
        </div>
      ) : video?.mp4_path ? (
        <div className="flex flex-col gap-4">
          <div
            className={cn(
              showReplay && "grid grid-cols-1 gap-4 lg:grid-cols-[1fr_340px]"
            )}
          >
            <VideoPlayer
              src={vodUrl(video.mp4_path)!}
              poster={vodUrl(video.thumbnail_path)}
              width={video.width}
              height={video.height}
              onTimeUpdate={(time) => setCurrentTimeMs(time * 1000)}
            />
            {showReplay && (
              <div className="lg:h-[70vh]">
                <ChatReplay
                  messages={replayMessages}
                  currentTimeMs={currentTimeMs}
                  onDismiss={() => setReplayDismissed(true)}
                  className="h-full"
                />
              </div>
            )}
          </div>
          <h1 className="text-2xl font-bold">{video.title ?? "Untitled"}</h1>
          <CommentsSection videoId={video.id} />
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
