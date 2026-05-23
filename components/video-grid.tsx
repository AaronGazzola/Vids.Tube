import { VideoCard, type VideoCardData } from "@/components/video-card";

export function VideoGrid({ videos }: { videos: VideoCardData[] }) {
  if (videos.length === 0) {
    return <p className="text-sm text-muted-foreground">No videos yet.</p>;
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {videos.map((video) => (
        <VideoCard key={video.id} video={video} />
      ))}
    </div>
  );
}
