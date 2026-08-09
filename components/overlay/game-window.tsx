"use client";

import { OVERLAY_BASE_DIMS } from "@/lib/demo-overlay";

// The window hosting the game. Its address is build-time configuration, never a saved layout value or a
// request parameter: whatever is framed here runs on the streaming machine, so it must not be something a
// viewer or a stored row can choose. The frame is muted because a browser source feeding the stream must
// not emit audio nobody asked for, and it takes no pointer events so a click cannot disturb it.
export function GameWindow() {
  const url = process.env.NEXT_PUBLIC_GAME_EMBED_URL;
  if (!url) {
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
        pointerEvents: "none",
        background: "transparent",
      }}
    />
  );
}
