"use client";

import type { OwnerStream } from "@/app/(app)/studio/layout.types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Film } from "lucide-react";
import Link from "next/link";

export type StudioRowAction = {
  key: string;
  label: string;
  href: string;
  variant?: "default" | "secondary" | "outline" | "ghost";
  disabled?: boolean;
  hint?: string;
};

function formatDate(iso: string | null): string {
  if (!iso) {
    return "No date";
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "No date";
  }
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatDuration(durationS: number | null): string | null {
  if (!durationS || durationS <= 0) {
    return null;
  }
  const hours = Math.floor(durationS / 3600);
  const minutes = Math.round((durationS % 3600) / 60);
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

export function StudioStreamRow({
  stream,
  actions,
}: {
  stream: OwnerStream;
  actions: StudioRowAction[];
}) {
  const duration = formatDuration(stream.durationS);

  return (
    <li className="flex items-center gap-3 rounded-lg border p-3 sm:gap-4">
      <div className="relative h-12 w-20 shrink-0 overflow-hidden rounded-md bg-muted sm:h-14 sm:w-24">
        {stream.thumbnailUrl ? (
          <img
            src={stream.thumbnailUrl}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
            <Film className="h-5 w-5" />
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{stream.title}</p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {formatDate(stream.startedAt)}
          {duration ? ` · ${duration}` : ""}
          {!stream.hasVod ? " · no VOD" : ""}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {!stream.hasTimeline && (
          <Badge variant="outline" className="hidden sm:inline-flex">
            Not labelled
          </Badge>
        )}
        {actions.map((action) => (
          <Button
            key={action.key}
            asChild={!action.disabled}
            size="sm"
            variant={action.variant ?? "outline"}
            disabled={action.disabled}
            title={action.hint}
            className={cn(action.disabled && "pointer-events-none opacity-50")}
          >
            {action.disabled ? (
              <span>{action.label}</span>
            ) : (
              <Link href={action.href}>{action.label}</Link>
            )}
          </Button>
        ))}
      </div>
    </li>
  );
}
