"use client";

import { ComingSoon } from "@/components/coming-soon";
import { PlayerPlaceholder } from "@/components/player-placeholder";
import { useParams } from "next/navigation";

export default function WatchPage() {
  const params = useParams<{ videoId: string }>();

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 p-4 md:p-6">
      <PlayerPlaceholder variant="vod" />
      <h1 className="mt-4 text-xl font-semibold">Sample VOD</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Placeholder · video {params.videoId}
      </p>
      <div className="mt-6">
        <ComingSoon title="Comments coming soon" />
      </div>
    </main>
  );
}
