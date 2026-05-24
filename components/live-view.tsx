"use client";

import { useLiveStream, useOwnerChannel } from "@/app/layout.hooks";
import { LiveChat } from "@/components/live-chat";
import { LiveStage } from "@/components/live-stage";
import { Skeleton } from "@/components/ui/skeleton";

export function LiveView() {
  const { data: channel, isPending } = useOwnerChannel();
  const { data: stream } = useLiveStream(channel?.id);
  const isLive = stream?.status === "live";
  const streamId = isLive ? stream.id : null;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_340px]">
      <div className="space-y-4">
        <LiveStage stream={stream} loading={isPending} />
        <div>
          {isPending ? (
            <Skeleton className="h-7 w-48" />
          ) : (
            <h1 className="text-xl font-semibold">{channel?.name ?? "Live"}</h1>
          )}
          <p className="mt-1 text-sm text-muted-foreground">
            {isLive ? "Live now" : "Offline"}
          </p>
        </div>
      </div>
      <div className="lg:h-[70vh]">
        <LiveChat streamId={streamId} />
      </div>
    </div>
  );
}
