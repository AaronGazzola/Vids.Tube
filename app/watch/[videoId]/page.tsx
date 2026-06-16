"use client";

import { ChatReplay } from "@/components/chat-replay";
import { CollapsibleDescription } from "@/components/collapsible-description";
import { CommentsSection } from "@/components/comments/comments-section";
import { Skeleton } from "@/components/ui/skeleton";
import { VideoPlayer } from "@/components/video-player";
import { cn } from "@/lib/utils";
import { useParams } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { useChatReplay, useVideo } from "./page.hooks";

const VOD_BASE_URL = process.env.NEXT_PUBLIC_VOD_BASE_URL ?? "";

const REPLAY_COLLAPSED_KEY = "vodReplayCollapsed";

const replayCollapsedListeners = new Set<() => void>();

function subscribeReplayCollapsed(callback: () => void) {
  replayCollapsedListeners.add(callback);
  return () => {
    replayCollapsedListeners.delete(callback);
  };
}

function getReplayCollapsedSnapshot(): boolean {
  return window.localStorage.getItem(REPLAY_COLLAPSED_KEY) === "true";
}

function getReplayCollapsedServerSnapshot(): boolean {
  return false;
}

function setReplayCollapsedPreference(value: boolean) {
  window.localStorage.setItem(REPLAY_COLLAPSED_KEY, String(value));
  replayCollapsedListeners.forEach((listener) => listener());
}

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
  const replayCollapsed = useSyncExternalStore(
    subscribeReplayCollapsed,
    getReplayCollapsedSnapshot,
    getReplayCollapsedServerSnapshot
  );

  const toggleReplayCollapsed = () =>
    setReplayCollapsedPreference(!replayCollapsed);

  const hasReplay = replayMessages.length > 0;
  const replayExpanded = hasReplay && !replayCollapsed;

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
              "flex flex-col gap-4",
              replayExpanded && "lg:grid lg:grid-cols-[1fr_340px]"
            )}
          >
            <VideoPlayer
              src={vodUrl(video.mp4_path)!}
              poster={vodUrl(video.thumbnail_path)}
              width={video.width}
              height={video.height}
              onTimeUpdate={(time) => setCurrentTimeMs(time * 1000)}
            />
            {hasReplay && (
              <div className={cn(replayExpanded && "lg:h-[70vh]")}>
                <ChatReplay
                  messages={replayMessages}
                  currentTimeMs={currentTimeMs}
                  collapsed={replayCollapsed}
                  onToggleCollapsed={toggleReplayCollapsed}
                  className="h-full"
                />
              </div>
            )}
          </div>
          <h1 className="text-2xl font-bold">{video.title ?? "Untitled"}</h1>
          {video.description && (
            <CollapsibleDescription text={video.description} />
          )}
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
