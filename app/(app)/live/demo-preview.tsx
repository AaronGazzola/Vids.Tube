"use client";

import type { FeaturedAuthor, GoalMetric, MetricProgress } from "@/app/layout.types";
import { useMyChannel } from "@/app/layout.hooks";
import {
  CHROME_ABOVE,
  CHROME_BELOW,
  MOBILE_CHROME_REF_WIDTH,
  MobileChromeOverlay,
  MobileChromeTopBar,
} from "@/components/mobile-chrome";
import { AvatarBubble } from "@/components/overlay/avatar-bubble";
import { GoalBar } from "@/components/overlay/goal-bar";
import { HighlightedMessage } from "@/components/overlay/highlighted-message";
import { Switch } from "@/components/ui/switch";
import { channelAssetUrl } from "@/lib/storage";
import { computeGoalProgress, type Counts } from "@/lib/goals";
import { computeStandings } from "@/lib/standings";
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
import {
  useDemoGeneratorStore,
  useDemoLayoutStore,
  type DemoViewer,
} from "./demo.stores";
import {
  DEMO_GOAL_TARGETS,
  DEMO_OVERLAY_LABELS,
  type DemoBackground,
  type DemoBoxKey,
} from "./demo.types";

const GRADIENT =
  "linear-gradient(135deg, #ff6b6b 0%, #f9d423 25%, #1dd1a1 50%, #54a0ff 75%, #5f27cd 100%)";

function authorOf(v: DemoViewer): FeaturedAuthor {
  return { name: v.name, handle: v.handle, avatarUrl: v.avatarUrl, avatarPath: null };
}

function reached(m: MetricProgress): MetricProgress {
  return { ...m, current: m.target || m.goal, pct: 100, reached: true };
}

// ── Draggable / resizable box ──────────────────────────────────────────────

function DraggableBox({
  boxKey,
  children,
}: {
  boxKey: DemoBoxKey;
  children: React.ReactNode;
}) {
  const box = useDemoLayoutStore((s) => s.config.boxes[boxKey]);
  const setBox = useDemoLayoutStore((s) => s.setBox);

  function startDrag(e: React.PointerEvent) {
    e.preventDefault();
    const start = { px: e.clientX, py: e.clientY, x: box.x, y: box.y };
    const move = (ev: PointerEvent) =>
      setBox(boxKey, {
        ...box,
        x: start.x + (ev.clientX - start.px),
        y: start.y + (ev.clientY - start.py),
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
        0.4,
        Math.min(3, start.scale + (ev.clientY - start.py) / 220)
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
      className="absolute cursor-move touch-none select-none"
      style={{
        left: box.x,
        top: box.y,
        transform: `scale(${box.scale})`,
        transformOrigin: "top left",
      }}
    >
      {children}
      <div
        onPointerDown={startResize}
        className="absolute -bottom-1.5 -right-1.5 h-4 w-4 cursor-nwse-resize rounded-full border border-white bg-black/70"
      />
    </div>
  );
}

// ── Competition bubbles field ──────────────────────────────────────────────

function CompetitionField() {
  const viewers = useDemoGeneratorStore((s) => s.viewers);
  const scores = useDemoGeneratorStore((s) => s.scores);

  const active = viewers
    .map((v) => ({ v, score: scores[v.key]?.total ?? 0 }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);

  const standings = computeStandings(
    active.map((x) => ({ id: x.v.key, score: x.score }))
  );

  return (
    <div className="relative" style={{ width: 300, height: 140 }}>
      {active.map((x, i) => {
        const st = standings.get(x.v.key) ?? { rank: i + 1, progress: 0 };
        const left = 4 + ((i * 37) % 80);
        const bottom = 6 + ((i * 53) % 60);
        const dur = 6 + (i % 5);
        const delay = (i % 7) * 0.6;
        return (
          <div
            key={x.v.key}
            className="absolute"
            style={{
              left: `${left}%`,
              bottom: `${bottom}%`,
              animation: `bubble-float ${dur}s ease-in-out ${delay}s infinite`,
            }}
          >
            <AvatarBubble
              author={authorOf(x.v)}
              progress={st.progress}
              rank={st.rank}
              size={52}
            />
          </div>
        );
      })}
    </div>
  );
}

// ── Highlight overlay ──────────────────────────────────────────────────────

function HighlightField() {
  const messages = useDemoGeneratorStore((s) => s.messages);
  const viewers = useDemoGeneratorStore((s) => s.viewers);
  const scores = useDemoGeneratorStore((s) => s.scores);
  const [done, setDone] = useState<Set<string>>(new Set());

  const current = [...messages]
    .reverse()
    .find(
      (m) => (m.promoted || m.featured) && !m.dismissed && !done.has(m.id)
    );
  if (!current) return null;

  const viewer = viewers.find((v) => v.key === current.viewerKey) ?? null;
  const active = viewers
    .map((v) => ({ id: v.key, score: scores[v.key]?.total ?? 0 }))
    .filter((x) => x.score > 0);
  const st =
    computeStandings(active).get(current.viewerKey) ?? { rank: 99, progress: 0 };

  return (
    <div className="pointer-events-none absolute left-1/2 top-6 w-[min(90%,420px)] -translate-x-1/2">
      <HighlightedMessage
        key={current.id}
        author={viewer ? authorOf(viewer) : null}
        text={current.text}
        rank={st.rank}
        progress={st.progress}
        onDone={() =>
          setDone((prev) => {
            const next = new Set(prev);
            next.add(current.id);
            return next;
          })
        }
      />
    </div>
  );
}

// ── Goal box ───────────────────────────────────────────────────────────────

const BOX_METRIC: Record<Exclude<DemoBoxKey, "competition">, GoalMetric> = {
  goalSubs: "subs",
  goalLikes: "likes",
  goalViewers: "viewers",
};

function GoalBox({ boxKey, data }: { boxKey: DemoBoxKey; data: MetricProgress }) {
  if (boxKey === "competition") return null;
  return <GoalBar metric={BOX_METRIC[boxKey]} data={data} height={110} />;
}

// ── Stage ──────────────────────────────────────────────────────────────────

export function DemoPreviewStage({ goals }: { goals: Counts | null }) {
  const { data: frames = [] } = useDemoFrames(true);
  const config = useDemoLayoutStore((s) => s.config);
  const toggleVisible = useDemoLayoutStore((s) => s.toggleVisible);
  const setGoalProgressFull = useDemoLayoutStore((s) => s.setGoalProgressFull);
  const setBackground = useDemoLayoutStore((s) => s.setBackground);
  const setMobileChrome = useDemoLayoutStore((s) => s.setMobileChrome);
  const resetLayout = useDemoLayoutStore((s) => s.resetLayout);
  const panelOpen = useDemoLayoutStore((s) => s.panelOpen);
  const setPanelOpen = useDemoLayoutStore((s) => s.setPanelOpen);
  const counts = useDemoGeneratorStore((s) => s.counts);
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

  const targets = goals ?? DEMO_GOAL_TARGETS;
  const progress = computeGoalProgress(
    counts,
    null,
    targets as Counts
  );
  const metricFor = (m: GoalMetric) =>
    config.goalProgressFull ? reached(progress[m]) : progress[m];

  const safeIndex = frames.length ? index % frames.length : 0;
  const frame = frames[safeIndex] ?? null;
  const bg = config.background;

  // Mobile-chrome geometry: anchor to the centered 9:16 video area and shrink
  // the whole stream stage just enough to fit the top bar above and the chat
  // input below, so every overlay keeps its position relative to the video.
  const chromeOn =
    config.mobileChrome && stageSize.w > 0 && stageSize.h > 0;
  const videoW = chromeOn
    ? Math.min(stageSize.w, (stageSize.h * 9) / 16)
    : 0;
  const chromeScale = videoW / MOBILE_CHROME_REF_WIDTH;
  const k = chromeOn
    ? stageSize.h /
      (stageSize.h + (CHROME_ABOVE + CHROME_BELOW) * chromeScale)
    : 1;
  const dy = chromeOn
    ? CHROME_ABOVE * chromeScale * k - (stageSize.h * (1 - k)) / 2
    : 0;
  const effScale = chromeScale * k;
  const videoWScaled = videoW * k;
  const gapTop = CHROME_ABOVE * chromeScale * k;

  return (
    <div
      ref={stageRef}
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
        {/* background */}
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
          <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-white/70">
            No published VODs yet — the overlays still render over a plain
            background.
          </div>
        )}

        {/* full-stage overlays */}
        {config.visible.highlight && <HighlightField />}

        {/* positioned box overlays */}
        {config.visible.goalSubs && (
          <DraggableBox boxKey="goalSubs">
            <GoalBox boxKey="goalSubs" data={metricFor("subs")} />
          </DraggableBox>
        )}
        {config.visible.goalLikes && (
          <DraggableBox boxKey="goalLikes">
            <GoalBox boxKey="goalLikes" data={metricFor("likes")} />
          </DraggableBox>
        )}
        {config.visible.goalViewers && (
          <DraggableBox boxKey="goalViewers">
            <GoalBox boxKey="goalViewers" data={metricFor("viewers")} />
          </DraggableBox>
        )}
        {config.visible.competition && (
          <DraggableBox boxKey="competition">
            <CompetitionField />
          </DraggableBox>
        )}
      </div>

      {/* mobile chrome anchored to the (scaled) video rect */}
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

      {/* slideshow controls */}
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

      {/* control panel */}
      {panelOpen && (
      <div className="absolute right-3 top-3 flex w-44 flex-col gap-2 rounded-lg bg-black/70 p-2.5 text-xs text-white backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <p className="font-semibold">Overlays</p>
          <button
            onClick={() => setPanelOpen(false)}
            className="rounded p-0.5 text-white/70 hover:bg-white/15 hover:text-white"
            aria-label="Hide overlay controls"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {(Object.keys(DEMO_OVERLAY_LABELS) as (keyof typeof DEMO_OVERLAY_LABELS)[]).map(
          (key) => (
            <label key={key} className="flex items-center justify-between gap-2">
              <span className="truncate">{DEMO_OVERLAY_LABELS[key]}</span>
              <Switch
                checked={config.visible[key]}
                onCheckedChange={() => toggleVisible(key)}
              />
            </label>
          )
        )}
        <div className="my-0.5 h-px bg-white/15" />
        <label className="flex items-center justify-between gap-2">
          <span>Goals reached</span>
          <Switch
            checked={config.goalProgressFull}
            onCheckedChange={(v) => setGoalProgressFull(v === true)}
          />
        </label>
        <label className="flex items-center justify-between gap-2">
          <span>Mobile layout</span>
          <Switch
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
