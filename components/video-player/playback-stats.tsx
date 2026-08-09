"use client";

import { cn } from "@/lib/utils";
import { useEffect, useRef, useState, type RefObject } from "react";
import type Hls from "hls.js";

// Half-second samples over the last thirty seconds. A spinner that flashes for a
// second is invisible in a live number and obvious in a strip of them, so the
// history is the point of this panel rather than a decoration on it.
const SAMPLE_MS = 500;
const HISTORY = 60;

// The tallest bar. Chosen against the edge's own window: the playlist carries
// seven one-second segments, so a viewer can never hold more than about seven
// seconds and a full-height bar means the buffer is as deep as it can get.
const BUFFER_SCALE_S = 7;

type Sample = { buffer: number; stalled: boolean };

type Stats = {
  buffer: number;
  latency: number | null;
  rate: number;
  bandwidthKbps: number | null;
  levelKbps: number | null;
  levelHeight: number | null;
  levelCount: number;
  droppedFrames: number;
  stalls: number;
  stalledSeconds: number;
  lastError: string | null;
  history: Sample[];
};

const EMPTY: Stats = {
  buffer: 0,
  latency: null,
  rate: 1,
  bandwidthKbps: null,
  levelKbps: null,
  levelHeight: null,
  levelCount: 0,
  droppedFrames: 0,
  stalls: 0,
  stalledSeconds: 0,
  lastError: null,
  history: [],
};

function bufferAhead(video: HTMLVideoElement): number {
  const t = video.currentTime;
  for (let i = 0; i < video.buffered.length; i++) {
    if (t >= video.buffered.start(i) && t <= video.buffered.end(i)) {
      return Math.max(0, video.buffered.end(i) - t);
    }
  }
  return 0;
}

function droppedFrames(video: HTMLVideoElement): number {
  const quality = video.getVideoPlaybackQuality?.();
  return quality ? quality.droppedVideoFrames : 0;
}

// What the numbers mean, in one line, because a reader chasing an intermittent
// stall should not have to hold the thresholds in their head.
function verdict(stats: Stats): { text: string; tone: "bad" | "warn" | "ok" } {
  const headroom =
    stats.bandwidthKbps !== null && stats.levelKbps
      ? stats.bandwidthKbps / stats.levelKbps
      : null;

  // Only a fatal error outranks the live readings. A recovered one is normal on a
  // live feed and would otherwise pin the verdict for the rest of the broadcast.
  if (stats.lastError?.includes("(fatal)")) {
    return { text: `Feed gave up: ${stats.lastError}`, tone: "bad" };
  }
  if (headroom !== null && headroom < 1) {
    return {
      text: "Download is slower than the stream itself — the buffer cannot refill.",
      tone: "bad",
    };
  }
  if (stats.stalls > 0 && headroom !== null && headroom < 1.5) {
    return {
      text: "Download is barely ahead of the stream — too little margin to absorb a wobble.",
      tone: "bad",
    };
  }
  if (stats.stalls > 0) {
    return {
      text: "Bandwidth looks sufficient, so the buffer is being kept too shallow at the live edge.",
      tone: "warn",
    };
  }
  if (stats.buffer < 1) {
    return { text: "Buffer is shallow but holding.", tone: "warn" };
  }
  return { text: "Playing without stalling.", tone: "ok" };
}

function Row({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "bad" | "warn";
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-white/55">{label}</span>
      <span
        className={cn(
          "font-mono tabular-nums",
          tone === "bad" && "text-red-400",
          tone === "warn" && "text-amber-300",
          !tone && "text-white"
        )}
      >
        {value}
      </span>
    </div>
  );
}

export function PlaybackStats({
  videoRef,
  hlsRef,
  lastErrorRef,
  onClose,
}: {
  videoRef: RefObject<HTMLVideoElement | null>;
  hlsRef: RefObject<Hls | null>;
  lastErrorRef: RefObject<string | null>;
  onClose?: () => void;
}) {
  const [stats, setStats] = useState<Stats>(EMPTY);
  const stallsRef = useRef(0);
  const stalledMsRef = useRef(0);
  const stallStartedRef = useRef<number | null>(null);
  const historyRef = useRef<Sample[]>([]);

  // Stalls are counted from the element rather than from hls.js, because the
  // spinner is painted from exactly these events: whatever made the video wait
  // is what the viewer saw.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }
    const onWaiting = () => {
      if (stallStartedRef.current === null) {
        stallStartedRef.current = performance.now();
        stallsRef.current += 1;
      }
    };
    const onResume = () => {
      if (stallStartedRef.current !== null) {
        stalledMsRef.current += performance.now() - stallStartedRef.current;
        stallStartedRef.current = null;
      }
    };
    video.addEventListener("waiting", onWaiting);
    video.addEventListener("stalled", onWaiting);
    video.addEventListener("playing", onResume);
    video.addEventListener("canplay", onResume);
    return () => {
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("stalled", onWaiting);
      video.removeEventListener("playing", onResume);
      video.removeEventListener("canplay", onResume);
    };
  }, [videoRef]);

  useEffect(() => {
    const id = window.setInterval(() => {
      const video = videoRef.current;
      if (!video) {
        return;
      }
      const hls = hlsRef.current;

      const level =
        hls && hls.levels.length > 0
          ? hls.levels[hls.currentLevel >= 0 ? hls.currentLevel : hls.loadLevel]
          : undefined;

      const buffer = bufferAhead(video);
      const stalled = stallStartedRef.current !== null;
      historyRef.current = [
        ...historyRef.current.slice(-(HISTORY - 1)),
        { buffer, stalled },
      ];

      setStats({
        buffer,
        latency: hls && Number.isFinite(hls.latency) ? hls.latency : null,
        rate: video.playbackRate,
        bandwidthKbps: hls ? Math.round(hls.bandwidthEstimate / 1000) : null,
        levelKbps: level ? Math.round(level.bitrate / 1000) : null,
        levelHeight: level?.height ?? null,
        levelCount: hls ? hls.levels.length : 0,
        droppedFrames: droppedFrames(video),
        stalls: stallsRef.current,
        stalledSeconds: Math.round(stalledMsRef.current / 100) / 10,
        lastError: lastErrorRef.current,
        history: historyRef.current,
      });
    }, SAMPLE_MS);
    return () => window.clearInterval(id);
  }, [videoRef, hlsRef, lastErrorRef]);

  const reset = () => {
    stallsRef.current = 0;
    stalledMsRef.current = 0;
    stallStartedRef.current = null;
    lastErrorRef.current = null;
    historyRef.current = [];
  };

  const headroom =
    stats.bandwidthKbps !== null && stats.levelKbps
      ? stats.bandwidthKbps / stats.levelKbps
      : null;
  const read = verdict(stats);

  // Kept narrow and low: a portrait preview is only about 420px wide, and the
  // spinner being diagnosed appears dead centre, so the panel stays clear of it.
  return (
    <div className="absolute bottom-16 left-2 z-20 w-60 rounded-lg bg-black/85 p-2.5 text-[11px] text-white backdrop-blur-sm">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="font-semibold uppercase tracking-wide text-white/70">
          Playback health
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={reset}
            className="rounded px-1.5 py-0.5 text-white/60 transition-colors hover:bg-white/15 hover:text-white"
          >
            Reset
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Hide playback health"
              className="rounded px-1.5 py-0.5 text-white/60 transition-colors hover:bg-white/15 hover:text-white"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      <div className="mb-2 flex h-10 items-end gap-px" aria-hidden>
        {Array.from({ length: HISTORY }, (_, i) => {
          const sample = stats.history[i - (HISTORY - stats.history.length)];
          const height = sample
            ? Math.max(2, Math.min(1, sample.buffer / BUFFER_SCALE_S) * 40)
            : 0;
          return (
            <div
              key={i}
              style={{ height }}
              className={cn(
                "flex-1 rounded-sm",
                !sample && "bg-white/5",
                sample?.stalled && "bg-red-500",
                sample && !sample.stalled && sample.buffer < 1 && "bg-amber-400",
                sample && !sample.stalled && sample.buffer >= 1 && "bg-emerald-400"
              )}
            />
          );
        })}
      </div>
      <p className="mb-2 text-[10px] text-white/40">
        Buffer held, last 30s. Red is a stall the viewer saw as a spinner.
      </p>

      <div className="space-y-1">
        <Row
          label="Buffer ahead"
          value={`${stats.buffer.toFixed(1)}s`}
          tone={stats.buffer < 0.5 ? "bad" : stats.buffer < 1.5 ? "warn" : undefined}
        />
        <Row
          label="Behind live"
          value={stats.latency === null ? "—" : `${stats.latency.toFixed(1)}s`}
        />
        <Row
          label="Speed"
          value={`${stats.rate.toFixed(2)}×`}
          tone={stats.rate > 1.01 ? "warn" : undefined}
        />
        <Row
          label="Download"
          value={
            stats.bandwidthKbps === null
              ? "—"
              : `${stats.bandwidthKbps.toLocaleString()} kbps`
          }
        />
        <Row
          label="Stream needs"
          value={
            stats.levelKbps === null
              ? "—"
              : `${stats.levelKbps.toLocaleString()} kbps`
          }
        />
        <Row
          label="Headroom"
          value={headroom === null ? "—" : `${headroom.toFixed(2)}×`}
          tone={headroom === null ? undefined : headroom < 1 ? "bad" : headroom < 1.5 ? "warn" : undefined}
        />
        <Row
          label="Quality"
          value={
            stats.levelCount === 0
              ? "—"
              : `${stats.levelHeight ?? "?"}p, ${stats.levelCount} available`
          }
          tone={stats.levelCount === 1 ? "warn" : undefined}
        />
        <Row
          label="Stalls"
          value={`${stats.stalls} (${stats.stalledSeconds}s)`}
          tone={stats.stalls > 0 ? "bad" : undefined}
        />
        <Row
          label="Dropped frames"
          value={stats.droppedFrames.toLocaleString()}
          tone={stats.droppedFrames > 0 ? "warn" : undefined}
        />
        {stats.lastError && (
          <Row
            label="Last feed error"
            value={stats.lastError}
            tone={stats.lastError.includes("(fatal)") ? "bad" : "warn"}
          />
        )}
      </div>

      <p
        className={cn(
          "mt-2 border-t border-white/15 pt-2 text-[11px] leading-snug",
          read.tone === "bad" && "text-red-300",
          read.tone === "warn" && "text-amber-200",
          read.tone === "ok" && "text-emerald-300"
        )}
      >
        {read.text}
      </p>
      {stats.levelCount === 1 && (
        <p className="mt-1 text-[10px] leading-snug text-white/45">
          Only one quality is published, so the player has nothing lower to drop
          to when the download falls behind.
        </p>
      )}
    </div>
  );
}
