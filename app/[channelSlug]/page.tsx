"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { useParams } from "next/navigation";
import { useChannel } from "./page.hooks";

export default function ChannelPage() {
  const params = useParams<{ channelSlug: string }>();
  const { data: channel, isPending } = useChannel(params.channelSlug);

  return (
    <main className="mx-auto w-full max-w-3xl p-8">
      {isPending ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-5 w-96" />
        </div>
      ) : channel ? (
        <>
          <h1 className="text-3xl font-bold">{channel.name}</h1>
          {channel.description && (
            <p className="mt-2 text-muted-foreground">{channel.description}</p>
          )}
          <p className="mt-8 text-sm text-muted-foreground">No videos yet.</p>
        </>
      ) : (
        <div className="text-center">
          <h1 className="text-2xl font-bold">Channel not found</h1>
          <p className="mt-2 text-muted-foreground">
            No channel exists at this address.
          </p>
        </div>
      )}
    </main>
  );
}
