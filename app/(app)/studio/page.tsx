"use client";

import { useOwnerStreams } from "@/app/(app)/studio/layout.hooks";
import type { OwnerStream } from "@/app/(app)/studio/layout.types";
import {
  StudioStreamRow,
  type StudioRowAction,
} from "@/components/studio-stream-row";
import { Skeleton } from "@/components/ui/skeleton";

function rowActions(stream: OwnerStream): StudioRowAction[] {
  return [
    {
      key: "timeline",
      label: "Timeline",
      href: `/studio/timeline/${stream.id}`,
      variant: stream.hasTimeline ? "default" : "outline",
      hint: stream.hasTimeline
        ? "Review this stream's timeline"
        : "This stream has not been labelled yet",
    },
  ];
}

function LoadingRows() {
  return (
    <ul className="space-y-2">
      {[0, 1, 2, 3, 4].map((key) => (
        <li key={key} className="flex items-center gap-3 rounded-lg border p-3">
          <Skeleton className="h-12 w-20 shrink-0 rounded-md sm:h-14 sm:w-24" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
          </div>
          <Skeleton className="h-8 w-24 shrink-0" />
        </li>
      ))}
    </ul>
  );
}

export default function StudioStreamsPage() {
  const { data: streams, isPending, error } = useOwnerStreams();

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-medium">Streams</h2>
        <p className="text-sm text-muted-foreground">
          Every stream on your channel, newest first.
        </p>
      </div>

      {isPending ? (
        <LoadingRows />
      ) : error ? (
        <p className="rounded-lg border border-destructive/40 p-4 text-sm text-destructive">
          {error.message}
        </p>
      ) : !streams || streams.length === 0 ? (
        <p className="rounded-lg border p-4 text-sm text-muted-foreground">
          No streams yet.
        </p>
      ) : (
        <ul className="space-y-2">
          {streams.map((stream) => (
            <StudioStreamRow
              key={stream.id}
              stream={stream}
              actions={rowActions(stream)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
