"use client";

import { cn } from "@/lib/utils";

// The live indicator doubles as the jump-to-live control: it is inert at the
// edge and, once the viewer has drifted behind, one click rejoins the edge.
export function TransportLive({
  atLiveEdge,
  secondsBehindLive,
  onJumpToLive,
}: {
  atLiveEdge: boolean | undefined;
  secondsBehindLive: number | undefined;
  onJumpToLive: () => void;
}) {
  const behind = atLiveEdge === false;

  return (
    <button
      type="button"
      onClick={behind ? onJumpToLive : undefined}
      aria-label={behind ? "Jump to live" : "Playing live"}
      aria-disabled={!behind}
      className={cn(
        "flex select-none items-center gap-1.5 rounded px-1.5 py-1 text-xs font-semibold uppercase tracking-wide text-white transition-colors",
        behind ? "hover:bg-white/15" : "cursor-default"
      )}
    >
      <span
        aria-hidden
        className={cn(
          "h-2 w-2 rounded-full",
          behind ? "bg-white/40" : "bg-red-500"
        )}
      />
      Live
      {behind && secondsBehindLive !== undefined && (
        <span className="font-normal normal-case tracking-normal text-white/60">
          −{Math.round(secondsBehindLive)}s
        </span>
      )}
    </button>
  );
}
