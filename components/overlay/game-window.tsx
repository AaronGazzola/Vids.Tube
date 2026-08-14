"use client";

import { OverlayEmptyState } from "@/components/overlay/empty-placeholder";
import { OVERLAY_BASE_DIMS } from "@/lib/demo-overlay";
import { framedOverlayUrl, type OverlayInstallation } from "@/lib/overlay-frame";

// The window hosting a framed overlay. What is framed comes from the overlay this channel installed, so
// two streamers running the same overlay frame two different addresses. The ORIGIN is still build-time
// configuration and nothing else: whatever is framed here runs on the streaming machine, so a database
// row must not be able to introduce an origin the Content-Security-Policy never named.
// The frame is muted because a browser source feeding the stream must not emit audio nobody asked for.
// The frame DOES take pointer events, so the game can be played through OBS's Interact window while
// streaming; nothing else on the overlay sits under it.
// In the layout editor an absent installation is expected rather than a fault, and the box still has to
// be positioned, so the editor asks for an outline where the stream itself gets nothing.
export function GameWindow({
  installation,
  placeholder = false,
}: {
  installation: OverlayInstallation | null | undefined;
  placeholder?: boolean;
}) {
  const permittedOrigin = process.env.NEXT_PUBLIC_GAME_EMBED_URL ?? "";
  const url = installation
    ? framedOverlayUrl(
        installation.entryUrl,
        installation.installId,
        permittedOrigin
      )
    : null;
  if (!url) {
    if (placeholder)
      return (
        <OverlayEmptyState
          label="Game"
          width={OVERLAY_BASE_DIMS.game.w}
          height={OVERLAY_BASE_DIMS.game.h}
        />
      );
    if (installation) {
      console.error(
        "game window shown but the installed overlay's entry origin is not the permitted origin"
      );
    } else if (installation === null) {
      console.error("game window shown but no overlay is installed on this channel");
    }
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
