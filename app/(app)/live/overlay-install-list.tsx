"use client";

import { framedOverlayUrl } from "@/lib/overlay-frame";
import { cn } from "@/lib/utils";
import {
  useChannelOverlays,
  useInstallOverlay,
  useRemoveOverlay,
} from "./overlay-registry.hooks";
import { OverlaySettingsPanel } from "./overlay-settings-panel";

// An overlay whose entry origin is not the one the Content-Security-Policy names
// frames nothing at all, and silence on stream is the worst way to find that out.
// The same function the renderer uses decides it, so the list cannot promise
// something the stream then refuses.
function renderable(entryUrl: string): boolean {
  return (
    framedOverlayUrl(
      entryUrl,
      "probe",
      process.env.NEXT_PUBLIC_GAME_EMBED_URL ?? ""
    ) !== null
  );
}

export function OverlayInstallList() {
  const { data, isPending } = useChannelOverlays();
  const install = useInstallOverlay();
  const remove = useRemoveOverlay();
  const busy = install.isPending || remove.isPending;

  return (
    <div className="space-y-1">
      <p className="font-semibold">Game overlays</p>
      {isPending ? (
        <div className="h-5 w-full animate-pulse rounded bg-white/15" />
      ) : !data?.length ? (
        <p className="text-[10px] leading-snug text-white/60">
          No overlays are published yet.
        </p>
      ) : (
        data.map((o) => {
          const ok = renderable(o.entryUrl);
          const installed = Boolean(o.installId);
          return (
            <div key={o.overlayId} className="space-y-0.5">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate">{o.name}</span>
                <button
                  disabled={busy}
                  onClick={() =>
                    installed
                      ? remove.mutate(o.overlayId)
                      : install.mutate(o.overlayId)
                  }
                  className={cn(
                    "rounded px-2 py-0.5 text-[10px] disabled:opacity-50",
                    installed
                      ? "bg-white/15 hover:bg-white/25"
                      : "bg-white text-black hover:bg-white/85"
                  )}
                >
                  {installed ? "Remove" : "Install"}
                </button>
              </div>
              {installed && ok && <OverlaySettingsPanel overlayId={o.overlayId} />}
              {installed && !ok && (
                <p
                  role="alert"
                  className="rounded bg-amber-500/20 px-2 py-1 text-[10px] leading-snug text-amber-200"
                >
                  This overlay is hosted somewhere the stream is not allowed to
                  frame, so nothing will render.
                </p>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
