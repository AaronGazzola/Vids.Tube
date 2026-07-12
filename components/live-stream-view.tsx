"use client";

import {
  useChannel,
  useUpcomingScheduled,
} from "@/app/[channelSlug]/page.hooks";
import { useLiveStream, useWaitingCount } from "@/app/layout.hooks";
import { CollapsibleDescription } from "@/components/collapsible-description";
import { LiveChat } from "@/components/live-chat";
import { LiveStage } from "@/components/live-stage";
import { ScheduledCard } from "@/components/scheduled-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

function LiveStreamSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_340px]">
      <div className="space-y-3">
        <Skeleton className="aspect-video w-full rounded-lg" />
        <Skeleton className="h-6 w-2/3" />
      </div>
      <Skeleton className="h-[70vh] w-full rounded-lg" />
    </div>
  );
}

export function LiveStreamView({ slug }: { slug: string }) {
  const router = useRouter();
  const { data: channel, isPending: channelPending } = useChannel(slug);
  const { data: stream, isPending: streamPending } = useLiveStream(channel?.id);
  const { data: upcomingScheduled, isPending: upcomingPending } =
    useUpcomingScheduled(channel?.id);

  const isLive = stream?.status === "live" && !!stream.hls_path;
  const upcoming = upcomingScheduled ?? null;
  const streamId = isLive ? stream.id : upcoming?.id ?? null;
  const waitingChatOpen = !isLive && !!upcoming?.waiting_room_chat;
  const waitingCount = useWaitingCount(!isLive ? upcoming?.id ?? null : null);

  const settled =
    !channelPending && (!channel || (!streamPending && !upcomingPending));
  const shouldRedirect = settled && (!channel || (!isLive && !upcoming));

  useEffect(() => {
    if (shouldRedirect) {
      router.replace(`/${slug}`);
    }
  }, [shouldRedirect, router, slug]);

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 p-4 md:p-6">
      {!settled || shouldRedirect ? (
        <LiveStreamSkeleton />
      ) : isLive ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_340px]">
          <div className="space-y-3">
            <LiveStage stream={stream} loading={false} />
            {stream?.title && (
              <h2 className="text-xl font-semibold tracking-tight">
                {stream.title}
              </h2>
            )}
            {stream?.description && (
              <CollapsibleDescription text={stream.description} />
            )}
          </div>
          <div className="lg:h-[70vh]">
            <LiveChat streamId={streamId} />
          </div>
        </div>
      ) : (
        <div
          className={
            waitingChatOpen
              ? "grid grid-cols-1 gap-4 lg:grid-cols-[1fr_340px]"
              : "mx-auto w-full max-w-3xl"
          }
        >
          <div className="space-y-3">
            <ScheduledCard broadcast={upcoming} />
            {upcoming?.title && (
              <h2 className="text-xl font-semibold tracking-tight">
                {upcoming.title}
              </h2>
            )}
            <p className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              {waitingCount === 1
                ? "1 person waiting"
                : `${waitingCount} people waiting`}
            </p>
          </div>
          {waitingChatOpen && (
            <div className="lg:h-[70vh]">
              <LiveChat streamId={streamId} />
            </div>
          )}
        </div>
      )}
    </main>
  );
}
