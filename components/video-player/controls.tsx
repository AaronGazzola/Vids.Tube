"use client";

import { cn } from "@/lib/utils";
import { Maximize, Minimize, Pause, Play } from "lucide-react";
import { SeekBar } from "./seek-bar";
import { SpeedMenu, type PlaybackSpeed } from "./speed-menu";
import { VolumeControl } from "./volume-control";
import type { VideoState } from "./use-video-state";

type ControlsProps = {
  state: VideoState;
  visible: boolean;
  onTogglePlay: () => void;
  onSeek: (time: number) => void;
  onVolume: (value: number) => void;
  onToggleMute: () => void;
  onPlaybackRate: (rate: PlaybackSpeed) => void;
  onToggleFullscreen: () => void;
};

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "0:00";
  }
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = h > 0 ? m.toString().padStart(2, "0") : m.toString();
  const ss = s.toString().padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function Controls({
  state,
  visible,
  onTogglePlay,
  onSeek,
  onVolume,
  onToggleMute,
  onPlaybackRate,
  onToggleFullscreen,
}: ControlsProps) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/70 via-black/15 to-transparent transition-opacity duration-200",
        visible ? "opacity-100" : "opacity-0"
      )}
      aria-hidden={!visible}
    >
      <div
        className={cn(
          "pointer-events-auto flex flex-col gap-1.5 px-3 pb-2 pt-6",
          visible ? "" : "pointer-events-none"
        )}
      >
        <SeekBar
          currentTime={state.currentTime}
          duration={state.duration}
          buffered={state.buffered}
          onSeek={onSeek}
        />
        <div className="flex items-center justify-between gap-2 text-white">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onTogglePlay}
              aria-label={state.isPlaying ? "Pause" : "Play"}
              className="rounded p-1 transition-colors hover:bg-white/15"
            >
              {state.isPlaying ? (
                <Pause className="h-5 w-5 fill-white" />
              ) : (
                <Play className="h-5 w-5 fill-white" />
              )}
            </button>
            <VolumeControl
              volume={state.volume}
              muted={state.muted}
              onVolume={onVolume}
              onToggleMute={onToggleMute}
            />
            <span className="ml-1 select-none text-xs tabular-nums text-white/90">
              {formatTime(state.currentTime)}{" "}
              <span className="text-white/60">
                / {formatTime(state.duration)}
              </span>
            </span>
          </div>
          <div className="flex items-center gap-1">
            <SpeedMenu value={state.playbackRate} onChange={onPlaybackRate} />
            <button
              type="button"
              onClick={onToggleFullscreen}
              aria-label={
                state.isFullscreen ? "Exit fullscreen" : "Enter fullscreen"
              }
              className="rounded p-1 text-white transition-colors hover:bg-white/15"
            >
              {state.isFullscreen ? (
                <Minimize className="h-5 w-5" />
              ) : (
                <Maximize className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
