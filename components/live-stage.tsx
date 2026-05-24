"use client";

import { useViewerCap } from "@/app/layout.hooks";
import type { Stream } from "@/app/layout.types";
import { LivePlayer } from "@/components/live-player";
import { OfflineCard } from "@/components/offline-card";
import { StreamFullWall } from "@/components/stream-full-wall";
import { Skeleton } from "@/components/ui/skeleton";

export function LiveStage({
  stream,
  loading,
}: {
  stream: Stream | null | undefined;
  loading: boolean;
}) {
  const isLive = stream?.status === "live" && !!stream.hls_path;
  const cap = useViewerCap(
    isLive ? stream.id : null,
    stream?.max_viewers ?? 25
  );

  if (loading) {
    return <Skeleton className="aspect-video w-full rounded-lg" />;
  }

  if (!isLive) {
    return <OfflineCard />;
  }

  if (cap === "connecting") {
    return <Skeleton className="aspect-video w-full rounded-lg" />;
  }

  if (cap === "full") {
    return <StreamFullWall />;
  }

  return <LivePlayer src={stream.hls_path!} />;
}
