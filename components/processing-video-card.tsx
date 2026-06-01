"use client";

import { cn } from "@/lib/utils";
import type { Database } from "@/supabase/types";
import { AlertCircle, Loader2 } from "lucide-react";

type Video = Database["public"]["Tables"]["videos"]["Row"];

function formatRelative(value: string | null): string {
  if (!value) {
    return "";
  }
  const then = new Date(value).getTime();
  if (!Number.isFinite(then)) {
    return "";
  }
  const seconds = Math.max(1, Math.floor((Date.now() - then) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function ProcessingVideoCard({ video }: { video: Video }) {
  const failed = video.status === "failed";

  return (
    <div className="group flex flex-col gap-3" aria-busy={!failed}>
      <div
        className={cn(
          "relative aspect-video w-full overflow-hidden rounded-xl border",
          failed
            ? "border-destructive/40 bg-destructive/5"
            : "border-dashed border-muted-foreground/30 bg-muted/40"
        )}
      >
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center">
          {failed ? (
            <>
              <AlertCircle
                className="h-7 w-7 text-destructive"
                aria-hidden
              />
              <span className="text-sm font-medium text-destructive">
                Processing failed
              </span>
              <span className="text-xs text-muted-foreground">
                Check the finalize log on the VM
              </span>
            </>
          ) : (
            <>
              <Loader2
                className="h-7 w-7 animate-spin text-muted-foreground"
                aria-hidden
              />
              <span className="text-sm font-medium text-muted-foreground">
                Processing…
              </span>
              <span className="text-xs text-muted-foreground/80">
                Your VOD will appear here when it&apos;s ready
              </span>
            </>
          )}
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <span className="line-clamp-2 font-medium leading-snug">
          {video.title ?? "Untitled stream"}
        </span>
        <span className="text-xs text-muted-foreground">
          {failed ? "Failed" : "Started"} {formatRelative(video.created_at)}
        </span>
      </div>
    </div>
  );
}
