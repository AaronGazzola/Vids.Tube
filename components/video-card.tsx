import { Card } from "@/components/ui/card";
import { Play } from "lucide-react";
import Link from "next/link";

export type VideoCardData = {
  id: string;
  title: string;
  meta?: string;
};

export function VideoCard({ video }: { video: VideoCardData }) {
  return (
    <Link href={`/watch/${video.id}`} className="group">
      <Card className="gap-0 overflow-hidden p-0">
        <div className="flex aspect-video items-center justify-center bg-muted text-muted-foreground">
          <Play className="h-8 w-8" />
        </div>
        <div className="p-3">
          <p className="line-clamp-2 text-sm font-medium group-hover:underline">
            {video.title}
          </p>
          {video.meta && (
            <p className="mt-1 text-xs text-muted-foreground">{video.meta}</p>
          )}
        </div>
      </Card>
    </Link>
  );
}
