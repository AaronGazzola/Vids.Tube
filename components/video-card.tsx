import { cn } from "@/lib/utils";
import type { Database } from "@/supabase/types";
import Link from "next/link";

type Video = Database["public"]["Tables"]["videos"]["Row"];

const VOD_BASE_URL = process.env.NEXT_PUBLIC_VOD_BASE_URL ?? "";

function formatDate(value: string | null): string {
  if (!value) {
    return "";
  }
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function VideoCard({ video }: { video: Video }) {
  return (
    <Link href={`/watch/${video.id}`} className="group flex flex-col gap-2">
      <div className="aspect-video w-full overflow-hidden rounded-lg bg-muted">
        {video.thumbnail_path && (
          <img
            src={`${VOD_BASE_URL}/${video.thumbnail_path}`}
            alt={video.title ?? "Video thumbnail"}
            className={cn(
              "h-full w-full object-cover transition-transform",
              "group-hover:scale-105"
            )}
          />
        )}
      </div>
      <div className="flex flex-col">
        <span className="line-clamp-2 font-medium">
          {video.title ?? "Untitled"}
        </span>
        {video.published_at && (
          <span className="text-sm text-muted-foreground">
            {formatDate(video.published_at)}
          </span>
        )}
      </div>
    </Link>
  );
}
