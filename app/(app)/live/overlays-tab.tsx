"use client";

import { useMyChannel } from "@/app/layout.hooks";
import {
  CHROME_ABOVE,
  CHROME_BELOW,
  MOBILE_CHROME_REF_WIDTH,
  MobileChromeOverlay,
  MobileChromeTopBar,
} from "@/components/mobile-chrome";
import { OverlayContainer } from "@/components/overlay/overlay-container";
import { OverlayStage } from "@/components/overlay/overlay-stage";
import { Switch } from "@/components/ui/switch";
import type { GoalMetric } from "@/app/layout.types";
import {
  GOAL_METRIC_BOX,
  OVERLAY_CANVAS_H,
  OVERLAY_CANVAS_W,
} from "@/lib/demo-overlay";
import type { Counts } from "@/lib/goals";
import { channelAssetUrl } from "@/lib/storage";
import { cn } from "@/lib/utils";
import {
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  RotateCcw,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useDemoFrames } from "./demo.hooks";
import { useDemoGeneratorStore, useDemoLayoutStore } from "./demo.stores";
import {
  DEMO_OVERLAY_LABELS,
  type DemoBackground,
  type DemoBoxKey,
} from "./demo.types";
import { OverlayInstallList } from "./overlay-install-list";
import { useOverlayDemoValues } from "./overlays-demo";
import { useOverlayComposerValues } from "./overlays-tab.hooks";

// Which overlay keys are goals, so the panel can offer the animation controls
// against the right rows. Inverted from the box mapping rather than written out
// again, so a goal added later cannot be missed here.
const GOAL_BOX_METRIC: Partial<Record<string, GoalMetric>> = Object.fromEntries(
  (Object.entries(GOAL_METRIC_BOX) as [GoalMetric, string][]).map(
    ([metric, box]) => [box, metric]
  )
);

const GRADIENT =
  "linear-gradient(135deg, #ff6b6b 0%, #f9d423 25%, #1dd1a1 50%, #54a0ff 75%, #5f27cd 100%)";

export function OverlaysTab({
  channelSlug,
  goals,
  isLive,
}: {
  channelSlug: string;
  goals: Counts | null;
  isLive: boolean;
}) {
  const { data: frames = [] } = useDemoFrames(true);
  const config = useDemoLayoutStore((s) => s.config);
  const setBox = useDemoLayoutStore((s) => s.setBox);
  const toggleVisible = useDemoLayoutStore((s) => s.toggleVisible);
  const setGoalProgressFull = useDemoLayoutStore((s) => s.setGoalProgressFull);
  const setBoxOpacity = useDemoLayoutStore((s) => s.setBoxOpacity);
  const setBackground = useDemoLayoutStore((s) => s.setBackground);
  const setMobileChrome = useDemoLayoutStore((s) => s.setMobileChrome);
  const resetLayout = useDemoLayoutStore((s) => s.resetLayout);
  const panelOpen = useDemoLayoutStore((s) => s.panelOpen);
  const setPanelOpen = useDemoLayoutStore((s) => s.setPanelOpen);
  const persist = useDemoLayoutStore((s) => s.persist);
  const setPersist = useDemoLayoutStore((s) => s.setPersist);
  const setGoalAnimate = useDemoLayoutStore((s) => s.setGoalAnimate);
  const demoGoalRise = useDemoLayoutStore((s) => s.demoGoalRise);
  const resizeMode = useDemoLayoutStore((s) => s.resizeMode);
  const setResizeMode = useDemoLayoutStore((s) => s.setResizeMode);
  const demo = useDemoLayoutStore((s) => s.demo);
  const setDemo = useDemoLayoutStore((s) => s.setDemo);
  const demoToObs = useDemoLayoutStore((s) => s.demoToObs);
  const setDemoToObs = useDemoLayoutStore((s) => s.setDemoToObs);
  const playHighlight = useDemoGeneratorStore((s) => s.playHighlight);
  const playTts = useDemoGeneratorStore((s) => s.playTts);
  const playAsk = useDemoGeneratorStore((s) => s.playAsk);
  const playFor = { highlight: playHighlight, tts: playTts, ask: playAsk } as const;
  const { data: myChannel } = useMyChannel();

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

  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!playing || frames.length < 2) return;
    const id = setInterval(
      () => setIndex((i) => (i + 1) % frames.length),
      4000
    );
    return () => clearInterval(id);
  }, [playing, frames.length]);

  const step = (dir: 1 | -1) => {
    setPlaying(false);
    setIndex((i) => (i + dir + frames.length) % Math.max(1, frames.length));
  };

  const feedVisible =
    config.visible.highlight || config.visible.tts || config.visible.ask;
  const demoValues = useOverlayDemoValues(goals, feedVisible);
  const realValues = useOverlayComposerValues(channelSlug, feedVisible, goals);
  const values = demo ? demoValues : realValues;

  const safeIndex = frames.length ? index % frames.length : 0;
  const frame = frames[safeIndex] ?? null;
  const bg = config.background;

  const canvasOnScreenW =
    stageSize.w > 0 && stageSize.h > 0
      ? Math.min(stageSize.w, (stageSize.h * 9) / 16)
      : 0;
  const canvasScale = canvasOnScreenW / OVERLAY_CANVAS_W;

  const chromeOn = config.mobileChrome && stageSize.w > 0 && stageSize.h > 0;
  const videoW = chromeOn ? canvasOnScreenW : 0;
  const chromeScale = videoW / MOBILE_CHROME_REF_WIDTH;
  const k = chromeOn
    ? stageSize.h / (stageSize.h + (CHROME_ABOVE + CHROME_BELOW) * chromeScale)
    : 1;
  const dy = chromeOn
    ? CHROME_ABOVE * chromeScale * k - (stageSize.h * (1 - k)) / 2
    : 0;
  const effScale = chromeScale * k;
  const videoWScaled = videoW * k;
  const gapTop = CHROME_ABOVE * chromeScale * k;
  const pxScale = canvasScale * k;

  return (
    <div
      ref={stageRef}
      data-testid="overlays-stage"
      className="relative h-full w-full overflow-hidden rounded-lg bg-black"
    >
      <div
        className="absolute inset-0"
        style={
          chromeOn
            ? { transform: `translate(0px, ${dy}px) scale(${k})` }
            : undefined
        }
      >
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
          {bg === "gradient" ? (
            <div className="absolute inset-0" style={{ background: GRADIENT }} />
          ) : bg === "slideshow" && frame ? (
            <img
              src={frame}
              alt=""
              className="absolute inset-0 h-full w-full object-contain"
            />
          ) : (
            <div className="absolute inset-0 bg-black" />
          )}

          {bg === "slideshow" && frames.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center px-16 text-center text-3xl text-white/70">
              No published VODs yet — the overlays still render over a plain
              background.
            </div>
          )}

          <OverlayStage
            config={config}
            boxes={config.boxes}
            visible={config.visible}
            surface="composer"
            values={values}
            resizeMode={resizeMode}
            wrapBox={(boxKey: DemoBoxKey, node) => (
              <OverlayContainer
                boxKey={boxKey}
                box={config.boxes[boxKey]}
                setBox={setBox}
                pxScale={pxScale}
                active={resizeMode}
                label={DEMO_OVERLAY_LABELS[boxKey] ?? boxKey}
              >
                {node}
              </OverlayContainer>
            )}
          />
        </div>
      </div>

      {chromeOn && (
        <div
          className="pointer-events-none absolute"
          style={{
            left: (stageSize.w - videoWScaled) / 2,
            top: gapTop,
            width: videoWScaled,
            height: stageSize.h * k,
          }}
        >
          <div className="absolute bottom-full left-0 right-0">
            <MobileChromeTopBar
              scale={effScale}
              handle={myChannel?.handle ?? null}
              avatarUrl={channelAssetUrl(myChannel?.avatar_path ?? null)}
            />
          </div>
          <MobileChromeOverlay scale={effScale} />
        </div>
      )}

      <div
        className={cn(
          "absolute bottom-3 flex items-center gap-1 rounded-full bg-black/70 px-2 py-1 text-white backdrop-blur-sm",
          chromeOn ? "left-3" : "left-1/2 -translate-x-1/2"
        )}
      >
        <button
          onClick={() => step(-1)}
          className="rounded p-1 hover:bg-white/15"
          aria-label="Previous frame"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          onClick={() => setPlaying((p) => !p)}
          className="rounded p-1 hover:bg-white/15"
          aria-label={playing ? "Pause slideshow" : "Play slideshow"}
        >
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </button>
        <button
          onClick={() => step(1)}
          className="rounded p-1 hover:bg-white/15"
          aria-label="Next frame"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <span className="px-1 text-[11px] tabular-nums text-white/70">
          {frames.length ? safeIndex + 1 : 0}/{frames.length}
        </span>
      </div>

      {panelOpen && (
        <div className="absolute right-3 top-3 flex max-h-[calc(100%-1.5rem)] w-48 flex-col gap-2 overflow-y-auto rounded-lg bg-black/70 p-2.5 text-xs text-white backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <p className="font-semibold">Overlays</p>
            <button
              onClick={() => setPanelOpen(false)}
              className="rounded p-0.5 text-white/70 hover:bg-white/15 hover:text-white"
              aria-label="Close overlay controls"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <label className="flex items-center justify-between gap-2">
            <span>Resize &amp; move</span>
            <Switch
              aria-label="Show resize and reposition containers"
              checked={resizeMode}
              onCheckedChange={(v) => setResizeMode(v === true)}
            />
          </label>

          <div className="my-0.5 h-px bg-white/15" />

          {(
            Object.keys(DEMO_OVERLAY_LABELS) as (keyof typeof DEMO_OVERLAY_LABELS)[]
          ).map((key) => (
            <div key={key} className="space-y-1">
              <label className="flex items-center justify-between gap-2">
                <span className="truncate">{DEMO_OVERLAY_LABELS[key]}</span>
                <Switch
                  checked={config.visible[key]}
                  onCheckedChange={() => toggleVisible(key)}
                />
              </label>
              {(key === "highlight" || key === "tts" || key === "ask") && (
                <div className="flex items-center justify-between gap-2 pl-2">
                  <button
                    onClick={playFor[key]}
                    className="rounded bg-white/15 px-2 py-0.5 text-[10px] hover:bg-white/25"
                    aria-label={`Play ${DEMO_OVERLAY_LABELS[key]}`}
                  >
                    Play
                  </button>
                  <label className="flex items-center gap-1 text-[10px] text-white/80">
                    <input
                      type="checkbox"
                      aria-label={`Persist ${DEMO_OVERLAY_LABELS[key]}`}
                      checked={persist[key]}
                      onChange={(e) => setPersist(key, e.target.checked)}
                    />
                    persist
                  </label>
                </div>
              )}
              {/* A goal announces its rises across the broadcast. Switchable per
                  goal, and demoable, because waiting for a real subscriber is a
                  poor way to judge how it looks. */}
              {GOAL_BOX_METRIC[key] && (
                <div className="flex items-center justify-between gap-2 pl-2">
                  <button
                    onClick={() => demoGoalRise(GOAL_BOX_METRIC[key]!)}
                    className="rounded bg-white/15 px-2 py-0.5 text-[10px] hover:bg-white/25"
                    aria-label={`Demo the ${DEMO_OVERLAY_LABELS[key]} increment`}
                  >
                    Demo
                  </button>
                  <label className="flex items-center gap-1 text-[10px] text-white/80">
                    <input
                      type="checkbox"
                      aria-label={`Animate ${DEMO_OVERLAY_LABELS[key]} increments`}
                      checked={config.goalAnimate[GOAL_BOX_METRIC[key]!]}
                      onChange={(e) =>
                        setGoalAnimate(GOAL_BOX_METRIC[key]!, e.target.checked)
                      }
                    />
                    animate
                  </label>
                </div>
              )}
              {/* The feed's card types share the highlight box, so they have no
                  box of their own to fade. */}
              {key !== "tts" && key !== "ask" && key !== "welcome" && (
                <div className="flex items-center gap-1.5 pl-2">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={Math.round(config.boxOpacity[key] * 100)}
                    onChange={(e) =>
                      setBoxOpacity(key, Number(e.target.value) / 100)
                    }
                    aria-label={`${DEMO_OVERLAY_LABELS[key]} opacity`}
                    className="min-w-0 flex-1 accent-primary"
                  />
                  <span className="w-7 text-right text-[10px] tabular-nums text-white/70">
                    {Math.round(config.boxOpacity[key] * 100)}%
                  </span>
                </div>
              )}
            </div>
          ))}

          <div className="my-0.5 h-px bg-white/15" />

          <OverlayInstallList />

          <div className="my-0.5 h-px bg-white/15" />

          <label className="flex items-center justify-between gap-2">
            <span>Demo</span>
            <Switch
              aria-label="Show demo values"
              checked={demo}
              onCheckedChange={(v) => setDemo(v === true)}
            />
          </label>
          <label className="flex items-center justify-between gap-2">
            <span>Goals reached</span>
            <Switch
              aria-label="Show goals as reached"
              checked={config.goalProgressFull}
              onCheckedChange={(v) => setGoalProgressFull(v === true)}
            />
          </label>
          <label className="flex items-center gap-1.5 text-[10px] text-white/80">
            <input
              type="checkbox"
              aria-label="Show demo in OBS as well as here"
              checked={demoToObs}
              onChange={(e) => setDemoToObs(e.target.checked)}
            />
            also show demo in OBS
          </label>
          {demoToObs && isLive && (
            <p
              role="alert"
              className="rounded bg-amber-500/20 px-2 py-1 text-[10px] leading-snug text-amber-200"
            >
              You are live. Viewers are seeing invented values, not the real
              ones.
            </p>
          )}

          <div className="my-0.5 h-px bg-white/15" />

          <label className="flex items-center justify-between gap-2">
            <span>Mobile layout</span>
            <Switch
              aria-label="Mobile layout"
              checked={config.mobileChrome}
              onCheckedChange={(v) => setMobileChrome(v === true)}
            />
          </label>
          <div className="flex items-center gap-1">
            {(["slideshow", "gradient", "black"] as DemoBackground[]).map((b) => (
              <button
                key={b}
                onClick={() => setBackground(b)}
                className={cn(
                  "flex-1 rounded px-1 py-0.5 text-[10px] capitalize",
                  bg === b ? "bg-white text-black" : "bg-white/15 hover:bg-white/25"
                )}
              >
                {b}
              </button>
            ))}
          </div>
          <button
            onClick={resetLayout}
            className="mt-0.5 flex items-center justify-center gap-1 rounded bg-white/15 px-2 py-1 hover:bg-white/25"
          >
            <RotateCcw className="h-3 w-3" /> Reset layout
          </button>
        </div>
      )}
    </div>
  );
}
