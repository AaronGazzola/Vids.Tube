"use client";

import { OverlayEmptyState } from "@/components/overlay/empty-placeholder";
import { OVERLAY_BASE_DIMS } from "@/lib/demo-overlay";

// The window hosting the game. Its address is build-time configuration, never a saved layout value or a
// request parameter: whatever is framed here runs on the streaming machine, so it must not be something a
// viewer or a stored row can choose. The frame is muted because a browser source feeding the stream must
// not emit audio nobody asked for. The frame DOES take pointer events, so the game can be played
// through OBS's Interact window while streaming; nothing else on the overlay sits under it.
// In the layout editor an absent address is expected rather than a fault, and the box still has to be
// positioned, so the editor asks for an outline where the stream itself gets nothing.
export function GameWindow({ placeholder = false }: { placeholder?: boolean }) {
  const url = process.env.NEXT_PUBLIC_GAME_EMBED_URL;
  if (!url) {
    if (placeholder)
      return (
        <OverlayEmptyState
          label="Game"
          width={OVERLAY_BASE_DIMS.game.w}
          height={OVERLAY_BASE_DIMS.game.h}
        />
      );
    console.error("game window shown but NEXT_PUBLIC_GAME_EMBED_URL is not set");
    return null;
  }
  return (
    <iframe
      src={url}
      title=""
      aria-hidden
      tabIndex={-1}
      scrolling="no"
      allow="autoplay 'none'"
      data-testid="game-window"
      style={{
        width: OVERLAY_BASE_DIMS.game.w,
        height: OVERLAY_BASE_DIMS.game.h,
        border: "none",
        background: "transparent",
      }}
    />
  );
}
