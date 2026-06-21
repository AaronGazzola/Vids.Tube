"use client";

import type { Stream } from "@/app/layout.types";
import { FittedThumbnail } from "@/components/fitted-thumbnail";
import { Badge } from "@/components/ui/badge";
import { vodAssetUrl } from "@/lib/storage";
import { CalendarClock, Radio } from "lucide-react";
import Link from "next/link";

function scheduledLabel(stream: Stream): string | null {
  if (!stream.scheduled_start_at) {
    return null;
  }
  return new Date(stream.scheduled_start_at).toLocaleString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function LiveFeatureCard({
  slug,
  stream,
  isLive,
}: {
  slug: string;
  stream: Stream;
  isLive: boolean;
}) {
  const thumbnailUrl = vodAssetUrl(stream.thumbnail_path);
  const title = stream.title || (isLive ? "Live now" : "Upcoming broadcast");
  const startLabel = isLive ? null : scheduledLabel(stream);

  const badge = isLive ? (
    <Badge
      variant="destructive"
      className="bg-destructive text-white dark:bg-destructive"
    >
      <Radio className="h-3 w-3" />
      LIVE
    </Badge>
  ) : (
    <Badge variant="secondary">
      <CalendarClock className="h-3 w-3" />
      {startLabel ? "Scheduled" : "Upcoming"}
    </Badge>
  );

  return (
    <Link
      href={`/${slug}/live`}
      className="group block overflow-hidden rounded-xl border bg-card transition-shadow hover:shadow-md"
    >
      <div className="relative">
        {thumbnailUrl ? (
          <FittedThumbnail
            src={thumbnailUrl}
            alt={title}
            zoomOnHover
            className="bg-muted/40"
          />
        ) : (
          <div className="aspect-video w-full bg-muted/40" />
        )}
        <div className="absolute left-3 top-3">{badge}</div>
      </div>
      <div className="space-y-1 p-4">
        <p className="line-clamp-2 text-base font-semibold tracking-tight">
          {title}
        </p>
        <p className="text-sm text-muted-foreground">
          {isLive ? "Watch the live stream" : startLabel ?? "Starting soon"}
        </p>
      </div>
    </Link>
  );
}
