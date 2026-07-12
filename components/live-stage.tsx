"use client";

import { useViewerCap } from "@/app/layout.hooks";
import type { Stream } from "@/app/layout.types";
import { LivePlayer } from "@/components/live-player";
import { OfflineCard } from "@/components/offline-card";
import { StreamFullWall } from "@/components/stream-full-wall";
import { Skeleton } from "@/components/ui/skeleton";
import { isFeedDisconnected } from "@/lib/stream";
import { WifiOff } from "lucide-react";

export function DisconnectedOverlay() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/70 p-6 text-center text-white backdrop-blur-sm">
      <WifiOff className="h-8 w-8" />
      <p className="text-lg font-semibold">Disconnected</p>
      <p className="text-sm text-white/70">
        Waiting for the stream to resume. Chat stays open.
      </p>
    </div>
  );
}

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

  const disconnected = isFeedDisconnected(stream);

  return (
    <div className="relative">
      <LivePlayer src={stream.hls_path!} />
      {disconnected && <DisconnectedOverlay />}
    </div>
  );
}
