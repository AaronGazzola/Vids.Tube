"use client";

import { OverlayEmptyState } from "@/components/overlay/empty-placeholder";
import { OVERLAY_BASE_DIMS } from "@/lib/demo-overlay";
import { framedOverlayUrl, type OverlayInstallation } from "@/lib/overlay-frame";
import type { OverlayEvent } from "@/lib/overlay-events";
import type { OverlayBoxSize } from "@/lib/overlay-messages";
import { useOverlayConversation } from "@/components/overlay/use-overlay-conversation";
import { useRef, useState } from "react";

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
  box = { width: OVERLAY_BASE_DIMS.game.w, height: OVERLAY_BASE_DIMS.game.h, scale: 1 },
  events,
  placeholder = false,
}: {
  installation: OverlayInstallation | null | undefined;
  box?: OverlayBoxSize;
  events?: OverlayEvent[];
  placeholder?: boolean;
}) {
  const permittedOrigin = process.env.NEXT_PUBLIC_GAME_EMBED_URL ?? "";
  const frameRef = useRef<HTMLIFrameElement | null>(null);

  useOverlayConversation({
    frameRef,
    permittedOrigin,
    channelId: installation?.channelId ?? null,
    settings: installation?.settings ?? null,
    box,
    events,
  });

  // The address is pinned to the INSTALLATION, not to the token. The host re-mints
  // on every poll of the installation, and letting each fresh token reach `src`
  // would reload the frame every fifteen seconds and restart whatever it was
  // running. A different installation is the one case that should swap the frame.
  //
  // State rather than a memo, because a memo is a performance hint React is free
  // to discard, and a discarded one here restarts the game.
  const [pinned, setPinned] = useState<{ key: string; url: string | null }>({
    key: "",
    url: null,
  });
  const key = installation
    ? `${installation.installId}|${installation.entryUrl}|${permittedOrigin}`
    : "";

  let url = installation && pinned.key === key ? pinned.url : null;
  if (installation && pinned.key !== key) {
    url = framedOverlayUrl(
      installation.entryUrl,
      installation.token,
      permittedOrigin
    );
    setPinned({ key, url });
  }

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
      ref={frameRef}
      src={url}
      title=""
      aria-hidden
      tabIndex={-1}
      scrolling="no"
      allow="autoplay 'none'"
      data-testid="game-window"
      // The box's own size, not the nominal one. The game is a camera on a
      // simulation rather than a card: a pinned frame stretched by a transform
      // gives it no more room and never triggers the reframe that a genuine
      // viewport change does.
      style={{
        width: box.width,
        height: box.height,
        border: "none",
        background: "transparent",
      }}
    />
  );
}
