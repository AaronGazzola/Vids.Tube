"use client";

import { useCurrentBroadcast } from "@/app/(app)/live/broadcast.hooks";
import { ActivityContent, ActivityIndicators } from "@/app/(app)/live/panels";
import { LivePlayer } from "@/components/live-player";
import { DisconnectedOverlay } from "@/components/live-stage";
import { isFeedDisconnected } from "@/lib/stream";
import { useSearchParams } from "next/navigation";

function PreviewPopout() {
  const { data: broadcast } = useCurrentBroadcast();
  const src = broadcast?.hls_path ?? null;
  const disconnected = broadcast ? isFeedDisconnected(broadcast) : false;

  return (
    <div className="flex h-screen flex-col bg-background p-3 text-foreground">
      {src ? (
        <LivePlayer
          src={src}
          overlay={disconnected ? <DisconnectedOverlay /> : null}
        />
      ) : (
        <div className="flex flex-1 items-center justify-center rounded-lg border text-sm text-muted-foreground">
          Start your encoder to see the private preview here.
        </div>
      )}
    </div>
  );
}

// The pop-out window renders the same content as the /live tab it was opened
// from: the preview player for `panel=preview`, otherwise the Activity panel.
export default function PopoutPage() {
  const panel = useSearchParams().get("panel");
  if (panel === "preview") {
    return <PreviewPopout />;
  }
  return (
    <div className="flex h-screen flex-col gap-3 bg-background p-3 text-foreground">
      <div className="flex shrink-0 items-center">
        <ActivityIndicators />
      </div>
      <div className="min-h-0 flex-1">
        <ActivityContent />
      </div>
    </div>
  );
}
