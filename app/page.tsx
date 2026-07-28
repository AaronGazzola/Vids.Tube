"use client";

import { useOwnerChannel } from "@/app/layout.hooks";
import { ChannelView } from "@/components/channel-view";
import { Skeleton } from "@/components/ui/skeleton";

export default function HomePage() {
  const { data: channel, isPending } = useOwnerChannel();

  if (isPending) {
    return (
      <main className="mx-auto w-full max-w-6xl flex-1 p-4 md:p-6">
        <Skeleton className="aspect-[5/1] w-full rounded-xl" />
        <div className="mt-6 flex items-center gap-4">
          <Skeleton className="h-24 w-24 rounded-full" />
          <Skeleton className="h-8 w-64" />
        </div>
      </main>
    );
  }

  if (!channel) {
    return (
      <main className="mx-auto w-full max-w-6xl flex-1 p-4 md:p-6">
        <div className="py-16 text-center">
          <h1 className="text-2xl font-bold">No channel yet</h1>
          <p className="mt-2 text-muted-foreground">
            The owner channel has not been created.
          </p>
        </div>
      </main>
    );
  }

  return <ChannelView slug={channel.slug} />;
}
