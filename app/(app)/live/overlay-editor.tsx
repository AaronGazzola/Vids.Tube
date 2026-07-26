"use client";

import { Button } from "@/components/ui/button";
import { CustomToast } from "@/components/CustomToast";
import { Switch } from "@/components/ui/switch";
import {
  OVERLAY_BASE_DIMS,
  OVERLAY_CANVAS_H,
  OVERLAY_CANVAS_W,
} from "@/lib/demo-overlay";
import { cn } from "@/lib/utils";
import { Copy, RefreshCw, RotateCcw, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  useOverlayUrlInfo,
  useRegenerateOverlayToken,
} from "./demo.hooks";
import { useDemoLayoutStore } from "./demo.stores";
import {
  DEMO_OVERLAY_LABELS,
  type DemoBoxKey,
  type DemoOverlayKey,
} from "./demo.types";

const BOX_DIMS: Record<DemoBoxKey, { w: number; h: number }> = {
  highlight: OVERLAY_BASE_DIMS.highlight,
  goalSubs: OVERLAY_BASE_DIMS.goal,
  goalLikes: OVERLAY_BASE_DIMS.goal,
  goalViewers: OVERLAY_BASE_DIMS.goal,
  competition: OVERLAY_BASE_DIMS.competition,
  break: OVERLAY_BASE_DIMS.break,
};

const BOX_KEYS: DemoBoxKey[] = [
  "highlight",
  "goalSubs",
  "goalLikes",
  "goalViewers",
  "competition",
  "break",
];

const TOGGLE_KEYS: DemoOverlayKey[] = [
  "highlight",
  "tts",
  "ask",
  "goalSubs",
  "goalLikes",
  "goalViewers",
  "competition",
  "break",
];

function boxShown(
  key: DemoBoxKey,
  visible: Record<DemoOverlayKey, boolean>
): boolean {
  if (key === "highlight") {
    return visible.highlight || visible.tts || visible.ask;
  }
  return visible[key];
}

function GhostBox({ boxKey, pxScale }: { boxKey: DemoBoxKey; pxScale: number }) {
  const box = useDemoLayoutStore((s) => s.config.boxes[boxKey]);
  const setBox = useDemoLayoutStore((s) => s.setBox);
  const dims = BOX_DIMS[boxKey];

  function startDrag(e: React.PointerEvent) {
    e.preventDefault();
    if (pxScale <= 0) return;
    const start = { px: e.clientX, py: e.clientY, x: box.x, y: box.y };
    const move = (ev: PointerEvent) =>
      setBox(boxKey, {
        ...box,
        x: start.x + (ev.clientX - start.px) / pxScale,
        y: start.y + (ev.clientY - start.py) / pxScale,
      });
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  function startResize(e: React.PointerEvent) {
    e.preventDefault();
    e.stopPropagation();
    const start = { py: e.clientY, scale: box.scale };
    const move = (ev: PointerEvent) => {
      const scale = Math.max(
        0.25,
        Math.min(6, start.scale + (ev.clientY - start.py) / 110)
      );
      setBox(boxKey, { ...box, scale });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  return (
    <div
      onPointerDown={startDrag}
      className="absolute cursor-move touch-none select-none rounded border-2 border-dashed border-white/70 bg-white/10"
      style={{
        left: box.x,
        top: box.y,
        width: dims.w,
        height: dims.h,
        transform: `scale(${box.scale})`,
        transformOrigin: "top left",
      }}
    >
      <span
        className="absolute left-1 top-1 rounded bg-black/70 px-1.5 py-0.5 text-white"
        style={{ fontSize: Math.max(11, 22 / box.scale) }}
      >
        {DEMO_OVERLAY_LABELS[boxKey]}
      </span>
      <div
        onPointerDown={startResize}
        className="absolute -bottom-1.5 -right-1.5 h-4 w-4 cursor-nwse-resize rounded-full border border-white bg-black/70"
        style={{
          transform: `scale(${pxScale > 0 ? 1 / (pxScale * box.scale) : 1})`,
          transformOrigin: "bottom right",
        }}
      />
    </div>
  );
}

// Live overlay layout editor on the Preview tab: ghost outlines dragged over
// the real HLS preview write the same saved layout the OBS frame renders, so
// edits land in OBS within ~1s — no demo mode, no fake data.
export function OverlayEditor({
  channelSlug,
  onClose,
}: {
  channelSlug: string;
  onClose: () => void;
}) {
  const config = useDemoLayoutStore((s) => s.config);
  const toggleVisible = useDemoLayoutStore((s) => s.toggleVisible);
  const setCompetitionOpacity = useDemoLayoutStore(
    (s) => s.setCompetitionOpacity
  );
  const setFeedSound = useDemoLayoutStore((s) => s.setFeedSound);
  const resetLayout = useDemoLayoutStore((s) => s.resetLayout);
  const urlInfo = useOverlayUrlInfo();
  const regenerate = useRegenerateOverlayToken();

  const stageRef = useRef<HTMLDivElement>(null);
  const [stageSize, setStageSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect) setStageSize({ w: rect.width, h: rect.height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const canvasOnScreenW =
    stageSize.w > 0 && stageSize.h > 0
      ? Math.min(stageSize.w, (stageSize.h * 9) / 16)
      : 0;
  const canvasScale = canvasOnScreenW / OVERLAY_CANVAS_W;

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const overlayUrl = urlInfo.data
    ? `${origin}/overlay/${channelSlug}?token=${urlInfo.data.token}`
    : null;

  const copyUrl = async () => {
    if (!overlayUrl) return;
    await navigator.clipboard.writeText(overlayUrl);
    toast.custom(() => (
      <CustomToast
        variant="success"
        title="Copied"
        message="Overlay URL copied — add it in OBS at 1080 × 1920."
      />
    ));
  };

  return (
    <div ref={stageRef} className="absolute inset-0">
      <div
        className="absolute overflow-hidden"
        style={{
          left: (stageSize.w - OVERLAY_CANVAS_W * canvasScale) / 2,
          top: (stageSize.h - OVERLAY_CANVAS_H * canvasScale) / 2,
          width: OVERLAY_CANVAS_W,
          height: OVERLAY_CANVAS_H,
          transform: `scale(${canvasScale})`,
          transformOrigin: "top left",
        }}
      >
        {BOX_KEYS.filter((key) => boxShown(key, config.visible)).map((key) => (
          <GhostBox key={key} boxKey={key} pxScale={canvasScale} />
        ))}
      </div>

      <div className="absolute right-2 top-2 flex w-52 flex-col gap-2 rounded-lg bg-black/80 p-2.5 text-xs text-white backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <p className="font-semibold">Overlay layout</p>
          <button
            onClick={onClose}
            className="rounded p-0.5 text-white/70 hover:bg-white/15 hover:text-white"
            aria-label="Close overlay editor"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {TOGGLE_KEYS.map((key) => (
          <label key={key} className="flex items-center justify-between gap-2">
            <span className="truncate">{DEMO_OVERLAY_LABELS[key]}</span>
            <Switch
              checked={config.visible[key]}
              onCheckedChange={() => toggleVisible(key)}
            />
          </label>
        ))}
        <div className="my-0.5 h-px bg-white/15" />
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span>Competition opacity</span>
            <span className="tabular-nums text-white/70">
              {Math.round(config.competitionOpacity * 100)}%
            </span>
          </div>
          <input
            type="range"
            min={10}
            max={100}
            value={Math.round(config.competitionOpacity * 100)}
            onChange={(e) =>
              setCompetitionOpacity(Number(e.target.value) / 100)
            }
            aria-label="Competition overlay opacity"
            className="w-full accent-primary"
          />
        </div>
        <div className="flex items-center justify-between gap-2">
          <span>Notification sound</span>
          <div className="flex items-center gap-1">
            {(["chime", "off"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setFeedSound(mode)}
                className={cn(
                  "rounded px-1.5 py-0.5 text-[10px] capitalize",
                  config.feedSound === mode
                    ? "bg-white text-black"
                    : "bg-white/15 hover:bg-white/25"
                )}
              >
                {mode === "off" ? "Mute" : mode}
              </button>
            ))}
          </div>
        </div>
        <div className="my-0.5 h-px bg-white/15" />
        <div className="flex items-center gap-1.5">
          <Button
            variant="secondary"
            size="sm"
            className="h-7 flex-1 text-[11px]"
            onClick={copyUrl}
            disabled={!overlayUrl}
          >
            <Copy className="mr-1 h-3 w-3" /> Copy OBS URL
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => regenerate.mutate()}
            disabled={regenerate.isPending}
            aria-label="Regenerate overlay token"
          >
            <RefreshCw className="h-3 w-3" />
          </Button>
        </div>
        <button
          onClick={resetLayout}
          className="flex items-center justify-center gap-1 rounded bg-white/15 px-2 py-1 hover:bg-white/25"
        >
          <RotateCcw className="h-3 w-3" /> Reset layout
        </button>
      </div>
    </div>
  );
}
