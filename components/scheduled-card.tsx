"use client";

import type { Stream } from "@/app/layout.types";
import { FittedThumbnail } from "@/components/fitted-thumbnail";
import { vodAssetUrl } from "@/lib/storage";
import { CalendarClock } from "lucide-react";
import { useEffect, useState } from "react";

function formatCountdown(targetMs: number, nowMs: number): string {
  const diff = Math.max(0, targetMs - nowMs);
  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }
  return `${minutes}m ${seconds}s`;
}

function ComingSoonCard({ broadcast }: { broadcast: Stream }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const thumbnailUrl = vodAssetUrl(broadcast.thumbnail_path);
  const startMs = broadcast.scheduled_start_at
    ? new Date(broadcast.scheduled_start_at).getTime()
    : null;
  const startLabel = broadcast.scheduled_start_at
    ? new Date(broadcast.scheduled_start_at).toLocaleString(undefined, {
        weekday: "long",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : null;

  const overlay = (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/70 p-6 text-center backdrop-blur-sm">
        <span className="inline-flex items-center gap-2 rounded-full bg-background/80 px-3 py-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <CalendarClock className="h-3.5 w-3.5" />
          Coming soon
        </span>
        <p className="text-xl font-semibold">
          {broadcast.title || "Upcoming broadcast"}
        </p>
        {startLabel && (
          <p className="text-sm text-muted-foreground">{startLabel}</p>
        )}
        {startMs && now < startMs ? (
          <p className="text-2xl font-bold tabular-nums">
            {formatCountdown(startMs, now)}
          </p>
        ) : (
          <p className="text-2xl font-bold">Starting soon</p>
        )}
      </div>
  );

  if (thumbnailUrl) {
    return (
      <FittedThumbnail
        src={thumbnailUrl}
        alt=""
        className="rounded-xl border bg-muted/40"
      >
        {overlay}
      </FittedThumbnail>
    );
  }

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-xl border bg-muted/40">
      {overlay}
    </div>
  );
}

export function ScheduledCard({
  broadcast,
}: {
  broadcast?: Stream | null;
}) {
  if (broadcast) {
    return <ComingSoonCard broadcast={broadcast} />;
  }

  return (
    <div className="flex aspect-video w-full flex-col items-center justify-center gap-3 rounded-xl border bg-muted/40 p-6 text-center">
      <CalendarClock className="h-10 w-10 text-muted-foreground" />
      <div className="space-y-1">
        <p className="text-lg font-semibold">No stream scheduled right now</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          When this channel goes live, the stream and chat will appear here.
          In the meantime, browse the videos below.
        </p>
      </div>
    </div>
  );
}
